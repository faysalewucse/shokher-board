import { useState, useEffect } from 'react';
import { Table, Button, Space, Select, message, Tooltip, Popconfirm } from 'antd';
import { BellOutlined, CheckCircleOutlined, DeleteOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router';
import { useNotifications } from '@/context/NotificationContext';
import PageHeader from '@/components/PageHeader';
import MonoTag, { PriorityTag, CountPill } from '@/components/MonoTag';
import MonoEmpty from '@/components/MonoEmpty';

const NotificationsPage = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    pagination,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [filters, setFilters] = useState({
    type: undefined,
    isRead: undefined,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // Load notifications on mount and when filters change
  useEffect(() => {
    fetchNotifications({
      page: 1,
      limit: 20,
      ...filters,
    });
  }, [filters, fetchNotifications]);

  // Handle pagination change. Wired to AntD's pagination.onChange, which is
  // called as (page, pageSize) — not a config object.
  const handleTableChange = (page, pageSize) => {
    fetchNotifications({ page, limit: pageSize, ...filters });
  };

  // Handle filter changes. Use ?? not || so isRead=false (the "Unread" option)
  // is preserved; allowClear passes undefined, which correctly clears it.
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value ?? undefined,
    }));
  };

  // Mark notification as read
  const handleMarkAsRead = async (notificationId) => {
    try {
      await markAsRead(notificationId);
      message.success('Notification marked as read');
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  // Mark selected as read
  const handleMarkSelectedAsRead = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select notifications to mark as read');
      return;
    }

    let successCount = 0;
    for (const id of selectedRowKeys) {
      try {
        await markAsRead(id);
        successCount++;
      } catch (error) {
        console.error(`Failed to mark ${id} as read:`, error);
      }
    }

    setSelectedRowKeys([]);
    if (successCount > 0) {
      message.success(`${successCount} notification(s) marked as read`);
    }
  };

  // Delete notification
  const handleDelete = async (notificationId) => {
    try {
      await deleteNotification(notificationId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  // Delete selected notifications
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select notifications to delete');
      return;
    }

    let successCount = 0;
    for (const id of selectedRowKeys) {
      try {
        await deleteNotification(id);
        successCount++;
      } catch (error) {
        console.error(`Failed to delete ${id}:`, error);
      }
    }

    setSelectedRowKeys([]);
    if (successCount > 0) {
      message.success(`${successCount} notification(s) deleted`);
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({ type: undefined, isRead: undefined });
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'Urgent';
      case 'high':
        return 'High';
      case 'low':
        return 'Low';
      default:
        return 'Normal';
    }
  };

  const getTypeLabel = (type) => {
    return type
      .split(/[._]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Pagination total display helper
  const showTotal = (total, range) => {
    return `${range[0]}-${range[1]} of ${total}`;
  };

  // Table columns
  const columns = [
    {
      title: 'Notification',
      dataIndex: 'title',
      key: 'title',
      width: '40%',
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: record.isRead ? 500 : 700, color: record.isRead ? 'var(--c-fg-2)' : 'var(--c-fg)' }}>
            {text}
          </div>
          <div style={{ fontSize: 12, color: 'var(--c-fg-2)', marginTop: 2 }}>
            {record.message}
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type) => (
        <MonoTag variant="soft">{getTypeLabel(type)}</MonoTag>
      ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => (
        <PriorityTag priority={priority} label={getPriorityLabel(priority)} />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isRead',
      key: 'isRead',
      width: 100,
      render: (isRead) => (
        isRead
          ? <MonoTag variant="muted">Read</MonoTag>
          : <MonoTag variant="solid" icon={<span className="mono-dot" />}>Unread</MonoTag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => <span className="mono text-[11.5px] text-fg-2">{new Date(date).toLocaleString()}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {!record.isRead && (
            <Tooltip title="Mark as read">
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                aria-label="Mark as read"
                onClick={(e) => { e.stopPropagation(); handleMarkAsRead(record.id); }}
              />
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              aria-label="Delete notification"
              onClick={(e) => { e.stopPropagation(); handleDelete(record.id); }}
            />
          </Tooltip>
          {record.actionUrl && (
            <Tooltip title="View details">
              <Button
                type="text"
                size="small"
                onClick={(e) => { e.stopPropagation(); navigate(record.actionUrl); }}
              >
                View
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const hasFilters = filters.type !== undefined || filters.isRead !== undefined;

  return (
    <div>
      <PageHeader
        title="Notifications"
        icon={<BellOutlined />}
        count={pagination?.total ?? 0}
        subtitle="View and manage all your notifications"
        actions={(
          <Space>
            {unreadCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-fg"><CountPill value={unreadCount} /> unread</span>
            )}
            {unreadCount > 0 && (
              <Button icon={<CheckCircleOutlined />} onClick={handleMarkAllAsRead}>
                Mark All Read
              </Button>
            )}
            <Tooltip title="Refresh">
              <Button
                icon={<ReloadOutlined />}
                aria-label="Refresh"
                onClick={() => fetchNotifications({ page: 1, limit: 20, ...filters })}
              />
            </Tooltip>
          </Space>
        )}
      />

      {/* Filters + bulk actions */}
      <div className="panel rise rise-1 flex flex-wrap items-center gap-2.5 mb-4 p-3">
        <Select
          placeholder="All types"
          style={{ width: 190 }}
          value={filters.type}
          onChange={(value) => handleFilterChange('type', value)}
          allowClear
        >
          <Select.Option value="admin.message">Admin Message</Select.Option>
          <Select.Option value="admin.broadcast">Broadcast</Select.Option>
          <Select.Option value="card.assigned">Card Assigned</Select.Option>
          <Select.Option value="card.mentioned">Card Mention</Select.Option>
          <Select.Option value="card.due_soon">Card Due Soon</Select.Option>
        </Select>
        <Select
          placeholder="All status"
          style={{ width: 140 }}
          value={filters.isRead}
          onChange={(value) => handleFilterChange('isRead', value)}
          allowClear
        >
          <Select.Option value={false}>Unread</Select.Option>
          <Select.Option value={true}>Read</Select.Option>
        </Select>
        {hasFilters && (
          <Button onClick={handleClearFilters}>Clear Filters</Button>
        )}

        {selectedRowKeys.length > 0 && (
          <>
            <div className="h-6 w-px bg-line mx-1" />
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-fg"><CountPill value={selectedRowKeys.length} /> selected</span>
            <Button icon={<CheckCircleOutlined />} onClick={handleMarkSelectedAsRead}>
              Mark as Read
            </Button>
            <Popconfirm
              title={`Delete ${selectedRowKeys.length} notification(s)?`}
              description="This cannot be undone."
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={handleDeleteSelected}
            >
              <Button danger type="primary" icon={<DeleteOutlined />}>
                Delete Selected
              </Button>
            </Popconfirm>
            <Button type="text" onClick={() => setSelectedRowKeys([])}>Cancel</Button>
          </>
        )}
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={notifications}
        loading={loading}
        locale={{
          emptyText: (
            <MonoEmpty
              description={hasFilters
                ? 'No notifications match your filters'
                : 'You have no notifications yet'}
            />
          ),
        }}
        pagination={{
          current: pagination.page,
          pageSize: pagination.limit,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: showTotal,
          onChange: handleTableChange,
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        onRow={(record) => ({
          style: {
            background: record.isRead ? 'transparent' : 'var(--c-surface-2)',
            boxShadow: record.isRead ? 'none' : 'inset 3px 0 0 0 var(--c-fg)',
            cursor: record.actionUrl ? 'pointer' : 'default',
          },
          onClick: () => {
            if (record.actionUrl) {
              if (!record.isRead) markAsRead(record.id).catch(() => {});
              navigate(record.actionUrl);
            }
          },
        })}
      />
    </div>
  );
};

export default NotificationsPage;