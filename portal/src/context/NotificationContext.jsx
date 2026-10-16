import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import notificationService from '@/services/notifications';
import { message } from 'antd';
import { useSocket } from '@/context/SocketContext';

const NotificationContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useNotifications = () => useContext(NotificationContext);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Use refs to prevent infinite loops
  const isLoadingRef = useRef(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async (options = {}) => {
    if (isLoadingRef.current) return; // Prevent duplicate calls

    isLoadingRef.current = true;
    setLoading(true);
    try {
      const result = await notificationService.getNotifications(options);
      setNotifications(result.data || []);
      setPagination(result.pagination || {});
      setUnreadCount(result.unreadCount || 0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      // Only show error message if it's not a 429 (rate limit) error
      if (error.response?.status !== 429) {
        message.error(error.message || 'Failed to load notifications');
      }
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Fetch unread count only (lightweight)
  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await notificationService.getUnreadCount();
      // Backend returns: { success: true, message: "...", data: { count } }
      setUnreadCount(result.data?.count || 0);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
      // Silently fail for count updates to avoid spamming errors
    }
  }, []);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, isRead: true, readAt: new Date().toISOString() }
            : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
      message.error(error.message || 'Failed to mark as read');
      throw error;
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();

      // Update local state
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, isRead: true, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
      message.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      message.error(error.message || 'Failed to mark all as read');
      throw error;
    }
  }, []);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);

      // Update local state
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === notificationId);
        if (notification && !notification.isRead) {
          setUnreadCount((count) => Math.max(0, count - 1));
        }
        return prev.filter((notif) => notif.id !== notificationId);
      });
      message.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      message.error(error.message || 'Failed to delete notification');
      throw error;
    }
  }, []);

  // Load notifications on mount and setup polling
  useEffect(() => {
    // Only fetch on initial mount if notifications list is empty
    if (notifications.length === 0) {
      fetchNotifications({ page: 1, limit: 20 });
    }

    // Refresh unread count every 5 minutes (reduced from 2 minutes)
    const interval = setInterval(() => {
      fetchUnreadCount();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchNotifications, fetchUnreadCount]);

  // Live push over the shared socket (server: lib/socket.js + notificationService).
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return undefined;
    const onNew = (notification) => {
      // Bulk sends carry no entity — just refresh.
      if (!notification || notification.bulk || !notification.id) {
        fetchNotifications({ page: 1, limit: 20 });
        return;
      }
      setNotifications((prev) => (prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]));
      if (!notification.isRead) setUnreadCount((c) => c + 1);
    };
    const onRead = ({ id } = {}) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    };
    const onCount = ({ count } = {}) => {
      if (typeof count === 'number') setUnreadCount(count);
    };
    socket.on('notification:new', onNew);
    socket.on('notification:read', onRead);
    socket.on('notification:unread-count', onCount);
    return () => {
      socket.off('notification:new', onNew);
      socket.off('notification:read', onRead);
      socket.off('notification:unread-count', onCount);
    };
  }, [socket, fetchNotifications]);

  const value = {
    notifications,
    unreadCount,
    loading,
    pagination,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
