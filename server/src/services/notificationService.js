const prisma = require("../lib/prisma");
const { throwError } = require("../utils/responseHandler");
const logger = require("../utils/logger");
const { emitToUser } = require("../lib/socket");

// Socket.IO events emitted to the user's room (see lib/socket.js)
const SOCKET_EVENT_NEW = "notification:new";
const SOCKET_EVENT_READ = "notification:read";
const SOCKET_EVENT_UNREAD_COUNT = "notification:unread-count";

/**
 * Create a notification for a user
 * @param {Object} data - Notification data
 * @param {string} data.userId - User ID to notify
 * @param {string} data.type - Notification type
 * @param {string} data.title - Short headline
 * @param {string} data.body - Detailed message (renamed to message in schema)
 * @param {Object} data.data - Optional related data (JSON)
 * @param {string} data.priority - Priority level (low, normal, high, urgent)
 * @param {string} data.actionUrl - Link to related page
 * @param {string} data.actionLabel - Button text
 * @param {Date} data.expiresAt - Expiration date
 */
const createNotification = async ({
  userId,
  type,
  title,
  body,
  message,
  data,
  priority,
  actionUrl,
  actionLabel,
  expiresAt,
}) => {
  if (!userId) throwError("userId is required", 400);
  if (!type) throwError("type is required", 400);
  if (!title) throwError("title is required", 400);

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message: message || body || null,
        data: data || null,
        priority: priority || "normal",
        actionUrl: actionUrl || null,
        actionLabel: actionLabel || null,
        expiresAt: expiresAt || null,
      },
    });

    logger.info(`Notification created: ${notification.id} for user ${userId}`);

    emitToUser(userId, SOCKET_EVENT_NEW, notification);

    return { notification };
  } catch (error) {
    logger.error(`Failed to create notification: ${error.message}`);
    throw error;
  }
};

const getUserNotifications = async (
  userId,
  { page = 1, limit = 20, unreadOnly, type } = {},
) => {
  try {
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where = { userId };
    if (unreadOnly === true || unreadOnly === "true") where.isRead = false;
    if (type) where.type = type;

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          data: true,
          priority: true,
          actionUrl: true,
          actionLabel: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      data: items,
      pagination: {
        page: Number(page) || 1,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
      unreadCount,
    };
  } catch (error) {
    logger.error(
      `Failed to get notifications for user ${userId}: ${error.message}`,
    );
    throw error;
  }
};

const getUnreadCount = async (userId) => {
  try {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  } catch (error) {
    logger.error(
      `Failed to get unread count for user ${userId}: ${error.message}`,
    );
    throw error;
  }
};

const markAsRead = async (userId, notificationId) => {
  try {
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!existing || existing.userId !== userId) {
      throwError("Notification not found", 404);
    }
    if (existing.isRead) return { notification: existing };

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });

    logger.info(`Notification marked as read: ${notificationId}`);

    emitToUser(userId, SOCKET_EVENT_READ, { id: notification.id });

    return { notification };
  } catch (error) {
    logger.error(`Failed to mark notification as read: ${error.message}`);
    throw error;
  }
};

const markAllAsRead = async (userId) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    logger.info(
      `Marked ${result.count} notifications as read for user ${userId}`,
    );

    emitToUser(userId, SOCKET_EVENT_UNREAD_COUNT, { count: 0 });

    return { updatedCount: result.count };
  } catch (error) {
    logger.error(
      `Failed to mark all as read for user ${userId}: ${error.message}`,
    );
    throw error;
  }
};

const deleteNotification = async (userId, notificationId) => {
  try {
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!existing || existing.userId !== userId) {
      throwError("Notification not found", 404);
    }

    await prisma.notification.delete({ where: { id: notificationId } });

    logger.info(`Notification deleted: ${notificationId}`);

    if (!existing.isRead) {
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false },
      });
      emitToUser(userId, SOCKET_EVENT_UNREAD_COUNT, { count: unreadCount });
    }

    return { message: "Notification deleted successfully" };
  } catch (error) {
    logger.error(`Failed to delete notification: ${error.message}`);
    throw error;
  }
};

/**
 * Create multiple notifications (bulk)
 * @param {Array<Object>} notifications - Array of notification data
 * @returns {Promise<Object>} Creation result
 */
const createBulkNotifications = async (notifications) => {
  try {
    const result = await prisma.notification.createMany({
      data: notifications.map((notif) => ({
        userId: notif.userId,
        type: notif.type,
        title: notif.title,
        message: notif.message || notif.body || null,
        data: notif.data || null,
        priority: notif.priority || "normal",
        actionUrl: notif.actionUrl || null,
        actionLabel: notif.actionLabel || null,
        expiresAt: notif.expiresAt || null,
      })),
      skipDuplicates: true,
    });

    logger.info(`Bulk notifications created: ${result.count} notifications`);

    // createMany doesn't return rows — nudge each recipient to refetch.
    const recipients = [...new Set(notifications.map((n) => n.userId))];
    recipients.forEach((userId) =>
      emitToUser(userId, SOCKET_EVENT_NEW, { bulk: true }),
    );
    return { createdCount: result.count };
  } catch (error) {
    logger.error(`Failed to create bulk notifications: ${error.message}`);
    throw error;
  }
};

/**
 * Send notification to multiple users
 * @param {Array<string>} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Bulk creation result
 */
const sendToUsers = async (userIds, notificationData) => {
  try {
    const notifications = userIds.map((userId) => ({
      ...notificationData,
      userId,
    }));

    return await createBulkNotifications(notifications);
  } catch (error) {
    logger.error(`Failed to send notifications to users: ${error.message}`);
    throw error;
  }
};

/**
 * Send notification to all users with a specific role
 * @param {string} roleName - Role name
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} Bulk creation result
 */
const sendToRole = async (roleName, notificationData) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: {
          name: roleName,
        },
      },
      select: {
        id: true,
      },
    });

    const userIds = users.map((user) => user.id);
    return await sendToUsers(userIds, notificationData);
  } catch (error) {
    logger.error(
      `Failed to send notifications to role ${roleName}: ${error.message}`,
    );
    throw error;
  }
};

/**
 * Send an in-app notification to every active user.
 * @param {Object} notificationData - Notification data (same shape as createNotification, minus userId)
 * @returns {Promise<Object>} Bulk creation result
 */
const sendToAllUsers = async (notificationData) => {
  try {
    const users = await prisma.user.findMany({
      where: { status: "active" },
      select: { id: true },
    });
    return await sendToUsers(users.map((u) => u.id), notificationData);
  } catch (error) {
    logger.error(`Failed to send notifications to all users: ${error.message}`);
    throw error;
  }
};

/**
 * Delete old read notifications (cleanup job)
 * @param {number} days - Delete notifications older than this many days (default: 90)
 * @returns {Promise<Object>} Cleanup result
 */
const cleanupOldNotifications = async (days = 90) => {
  try {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await prisma.notification.deleteMany({
      where: {
        isRead: true,
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(
      `Cleaned up ${result.count} old notifications (older than ${days} days)`,
    );
    return { deletedCount: result.count, days };
  } catch (error) {
    logger.error(`Failed to cleanup old notifications: ${error.message}`);
    throw error;
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createBulkNotifications,
  sendToUsers,
  sendToRole,
  sendToAllUsers,
  cleanupOldNotifications,
  SOCKET_EVENT_NEW,
  SOCKET_EVENT_READ,
  SOCKET_EVENT_UNREAD_COUNT,
};
