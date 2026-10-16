import { useState, useRef } from 'react';
import { Dropdown, Tooltip, Button, List, Typography, Skeleton } from 'antd';
import MonoEmpty from '@/components/MonoEmpty';
import { PriorityTag, CountPill } from '@/components/MonoTag';
import { BellOutlined, BellFilled, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useNotifications } from '@/context/NotificationContext';

const { Text } = Typography;

const NotificationBell = () => {
  const navigate = useNavigate();
  const { notifications, unreadCount, loading, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const hasFetched = useRef(false);

  // Get recent 5 notifications for dropdown
  const recentNotifications = notifications.slice(0, 5);

  // Fetch notifications when dropdown opens (only once per session)
  const handleDropdownChange = (open) => {
    setDropdownOpen(open);
    if (open && !hasFetched.current) {
      fetchNotifications({ page: 1, limit: 5 });
      hasFetched.current = true;
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Navigate to action URL if available
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }

    setDropdownOpen(false);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleViewAll = () => {
    navigate('/notifications');
    setDropdownOpen(false);
  };

  const handleDelete = async (e, notificationId) => {
    e.stopPropagation(); // Prevent navigation
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const notificationContent = (
    <div
      className="notif-pop"
      style={{
        width: 380,
        maxHeight: 500,
        overflow: 'hidden',
        backgroundColor: 'var(--c-surface)',
        borderRadius: 6,
        border: '1px solid var(--c-fg)',
        boxShadow: 'var(--shadow-hard-lg)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text strong style={{ fontSize: 15, color: 'var(--c-fg)', fontFamily: 'var(--ff-display)', letterSpacing: '-0.02em' }}>Notifications</Text>
          {unreadCount > 0 && <CountPill value={unreadCount} />}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {unreadCount > 0 && (
            <Button
              type="link"
              size="small"
              onClick={handleMarkAllAsRead}
              style={{ padding: 0, fontSize: 12, height: 'auto', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Notification List */}
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} active title={{ width: '60%' }} paragraph={{ rows: 1, width: '90%' }} />)}
          </div>
        ) : recentNotifications.length === 0 ? (
          <MonoEmpty description="You're all caught up" />
        ) : (
          <List
            dataSource={recentNotifications}
            renderItem={(notification) => (
              <List.Item
                key={notification.id}
                className="notif-row"
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--c-line)',
                  background: notification.isRead ? 'transparent' : 'var(--c-surface-2)',
                  boxShadow: notification.isRead ? 'none' : 'inset 3px 0 0 0 var(--c-fg)',
                }}
                onClick={() => handleNotificationClick(notification)}
                actions={[
                  !notification.isRead && (
                    <Tooltip title="Mark as read" key="read">
                      <Button
                        type="text"
                        size="small"
                        aria-label="Mark as read"
                        icon={<CheckOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                      />
                    </Tooltip>
                  ),
                  <Tooltip title="Delete" key="delete">
                    <Button
                      type="text"
                      size="small"
                      aria-label="Delete notification"
                      icon={<DeleteOutlined />}
                      onClick={(e) => handleDelete(e, notification.id)}
                    />
                  </Tooltip>,
                ]}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                      <Text
                        style={{
                          fontSize: 13,
                          color: notification.isRead ? 'var(--c-fg-2)' : 'var(--c-fg)',
                          fontWeight: notification.isRead ? 500 : 700,
                        }}
                      >
                        {notification.title}
                      </Text>
                      {(notification.priority === 'urgent' || notification.priority === 'high') && (
                        <PriorityTag priority={notification.priority} />
                      )}
                    </div>
                    <Text
                      style={{
                        fontSize: 12,
                        color: 'var(--c-fg-2)',
                        lineHeight: 1.45,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {notification.message}
                    </Text>
                    <Text className="mono" style={{ fontSize: 10.5, color: 'var(--c-fg-3)', marginTop: 6, display: 'block' }}>
                      {new Date(notification.createdAt).toLocaleString()}
                    </Text>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </div>

      {/* Footer */}
      {recentNotifications.length > 0 && (
        <button
          type="button"
          onClick={handleViewAll}
          className="mono w-full border-0 bg-inv py-2.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.14em] text-on-inv transition-opacity hover:opacity-85"
          style={{ cursor: 'pointer' }}
        >
          View all notifications →
        </button>
      )}
    </div>
  );

  return (
    <Dropdown
      open={dropdownOpen}
      onOpenChange={handleDropdownChange}
      trigger={['click']}
      placement="bottomRight"
      popupRender={() => notificationContent}
    >
      <Tooltip title={unreadCount > 0 ? `${unreadCount} unread` : 'Notifications'}>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button"
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className={`icon-btn ${unreadCount > 0 ? 'icon-btn--active' : ''}`}
          >
            {unreadCount > 0 ? <BellFilled style={{ fontSize: 15 }} /> : <BellOutlined style={{ fontSize: 15 }} />}
          </button>
          {unreadCount > 0 && (
            <span
              className="mono"
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                pointerEvents: 'none',
                minWidth: 18,
                height: 18,
                padding: '0 4px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--c-surface)',
                color: 'var(--c-fg)',
                border: '1.5px solid var(--c-fg)',
                borderRadius: 9,
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                zIndex: 10,
              }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </Tooltip>
    </Dropdown>
  );
};

export default NotificationBell;
