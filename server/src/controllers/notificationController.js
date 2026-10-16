const notificationService = require('../services/notificationService');
const { successResponse } = require('../utils/responseHandler');

/**
 * Get notifications for authenticated user
 * @route GET /api/notifications
 */
const list = async (req, res, next) => {
  try {
    const { data, pagination, unreadCount } = await notificationService.getUserNotifications(
      req.user.id,
      req.query,
    );
    return successResponse(res, {
      message: 'Notifications fetched successfully',
      data,
      pagination,
      unreadCount,
    });
  } catch (err) { next(err); }
};

/**
 * Get unread notification count
 * @route GET /api/notifications/unread-count
 */
const unreadCount = async (req, res, next) => {
  try {
    const result = await notificationService.getUnreadCount(req.user.id);
    return successResponse(res, {
      message: 'Unread count fetched successfully',
      data: result,
    });
  } catch (err) { next(err); }
};

/**
 * Mark notification as read
 * @route PATCH /api/notifications/:id/read
 */
const markRead = async (req, res, next) => {
  try {
    const { notification } = await notificationService.markAsRead(
      req.user.id,
      req.params.id,
    );
    return successResponse(res, {
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (err) { next(err); }
};

/**
 * Mark all notifications as read
 * @route PATCH /api/notifications/read-all
 */
const markAllRead = async (req, res, next) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);
    return successResponse(res, {
      message: 'All notifications marked as read',
      data: result,
    });
  } catch (err) { next(err); }
};

/**
 * Delete notification
 * @route DELETE /api/notifications/:id
 */
const remove = async (req, res, next) => {
  try {
    const result = await notificationService.deleteNotification(req.user.id, req.params.id);
    return successResponse(res, {
      message: 'Notification deleted successfully',
      data: result,
    });
  } catch (err) { next(err); }
};

/**
 * Cleanup old notifications (admin only)
 * @route DELETE /api/notifications/cleanup
 */
const cleanup = async (req, res, next) => {
  try {
    const { days = 90 } = req.query;
    const result = await notificationService.cleanupOldNotifications(parseInt(days));
    return successResponse(res, {
      message: 'Old notifications cleaned up successfully',
      data: result,
    });
  } catch (err) { next(err); }
};

/**
 * Broadcast an in-app notification to every active user.
 * @route POST /api/notifications/broadcast
 */
const broadcast = async (req, res, next) => {
  try {
    const { title, body, actionUrl } = req.body;
    const { createdCount } = await notificationService.sendToAllUsers({
      type: 'admin.broadcast',
      title,
      message: body,
      actionUrl: actionUrl || null,
      actionLabel: actionUrl ? 'View' : null,
      priority: 'normal',
    });
    return successResponse(res, {
      message: `Notification broadcast to ${createdCount} users`,
    });
  } catch (err) { next(err); }
};

module.exports = { list, unreadCount, markRead, markAllRead, remove, cleanup, broadcast };
