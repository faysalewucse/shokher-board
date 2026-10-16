import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Space,
  Avatar, Tooltip, message,
} from 'antd';
import DateRangePicker from '@/components/DateRangePicker';

import {
  UserAddOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, ReloadOutlined, UserOutlined, BellOutlined, NotificationOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import usePermission from '@/hooks/usePermission';
import useDebounce from '@/hooks/useDebounce';
import UserDrawer from './UserDrawer';
import SendNotificationModal from './SendNotificationModal';
import PageHeader from '@/components/PageHeader';
import RowActions from '@/components/RowActions';
import MonoTag, { StatusTag, YesNoTag } from '@/components/MonoTag';
import { MonoArt } from '@/components/MonoEmpty';

export default function Users() {
  const canRead    = usePermission('USER_READ_ANY');
  const canCreate  = usePermission('USER_CREATE');
  const canUpdate  = usePermission('USER_UPDATE_ANY');
  const canDelete  = usePermission('USER_DELETE_ANY');
  const canNotify  = usePermission('NOTIFICATION_SEND');

  const [users, setUsers]         = useState([]);
  const [roles, setRoles]         = useState([]);
  const [meta, setMeta]           = useState({ total: 0, page: 1, limit: 10 });
  const [loading, setLoading]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter]     = useState('');
  const [dateRange, setDateRange]       = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [notifyUser, setNotifyUser] = useState(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const debouncedSearch = useDebounce(search);

  const fetchUsers = useCallback(async (page = 1) => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get('/users', {
        params: {
          page,
          limit: meta.limit,
          search: debouncedSearch,
          status: statusFilter,
          role: roleFilter,
          dateFrom: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
          dateTo: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
        },
      });
      setUsers(data.data);
      setMeta(data.meta);
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [canRead, debouncedSearch, statusFilter, roleFilter, dateRange, meta.limit]);

  const fetchRoles = useCallback(async () => {
    try {
      const { data } = await api.get('/roles');
      setRoles(data.data || []);
    } catch {
      // roles are optional for the form
    }
  }, []);

  useEffect(() => {
    fetchUsers(1);
    fetchRoles();
  }, [debouncedSearch, statusFilter, roleFilter, dateRange]);

  const openCreate = () => { setEditingUser(null); setDrawerOpen(true); };
  const openEdit   = (user) => { setEditingUser(user); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingUser(null); };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingUser) {
        await api.patch(`/users/${editingUser.id}`, values);
        message.success('User updated');
      } else {
        await api.post('/users', values);
        message.success('User created');
      }
      closeDrawer();
      fetchUsers(meta.page);
    } catch (err) {
      message.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { data } = await api.delete(`/users/${id}`);
      message.success(data.message || 'User deleted');
      fetchUsers(meta.page);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.avatar} shape="square" style={{ background: 'var(--c-surface-3)', color: 'var(--c-fg)', border: '1px solid var(--c-line)', borderRadius: 4 }} />
          <div>
            <div className="font-semibold text-[13px] text-fg">{record.name}</div>
            <div className="text-xs text-fg-3">{record.email}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Role',
      dataIndex: ['role', 'name'],
      key: 'role',
      render: (name) => name ? <MonoTag variant="soft">{name}</MonoTag> : <span className="text-fg-3">—</span>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <StatusTag status={status} />
      ),
    },
    {
      title: 'Verified',
      dataIndex: 'isEmailVerified',
      key: 'isEmailVerified',
      align: 'center',
      render: (v) => <YesNoTag value={v} />,
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d) => <span className="mono text-[12px] text-fg-2">{new Date(d).toLocaleDateString()}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      render: (_, record) => (
        <RowActions
          canEdit={canUpdate}
          canDelete={canDelete}
          onEdit={() => openEdit(record)}
          onDelete={() => handleDelete(record.id)}
          deleteConfirmTitle="Delete this user?"
          deleteConfirmDescription="This action cannot be undone."
          extra={(
            <Space size={4}>
              {canNotify && (
                <Tooltip title="Send Notification">
                  <Button size="small" icon={<BellOutlined />} onClick={() => setNotifyUser(record)} aria-label="Send notification" />
                </Tooltip>
              )}
            </Space>
          )}
        />
      ),
    },
  ];

  if (!canRead) {
    return (
      <div className="panel flex h-64 flex-col items-center justify-center gap-2 text-fg-2">
        <MonoArt kind="403" size={96} />
        <span className="font-semibold">You do not have permission to view users.</span>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users"
        count={meta.total}
        icon={<UserOutlined />}
        actions={(
          <Space>
            {canNotify && (
              <Button icon={<NotificationOutlined />} onClick={() => setBroadcastOpen(true)}>
                Notify All Users
              </Button>
            )}
            {canCreate && (
              <Button type="primary" icon={<UserAddOutlined />} onClick={openCreate}>
                Add User
              </Button>
            )}
          </Space>
        )}
      />

      <div className="panel rise rise-1 flex flex-wrap gap-2.5 mb-4 p-3">
        <Input
          prefix={<SearchOutlined className="text-fg-3" />}
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ maxWidth: 280 }}
        />
        <Select
          placeholder="Filter by status"
          allowClear
          value={statusFilter || undefined}
          onChange={(v) => setStatusFilter(v || '')}
          style={{ width: 150 }}
          options={[
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
            { label: 'Suspended', value: 'suspended' },
            { label: 'Pending', value: 'pending' },
            { label: 'Deleted', value: 'deleted' },
          ]}
        />
        <Select
          placeholder="Filter by role"
          allowClear
          value={roleFilter || undefined}
          onChange={(v) => setRoleFilter(v || '')}
          style={{ width: 150 }}
          options={roles.map((r) => ({ label: r.name, value: r.id }))}
        />
        <DateRangePicker
          value={dateRange}
          onChange={(v) => setDateRange(v)}
        />
        <Tooltip title="Refresh">
          <Button icon={<ReloadOutlined />} onClick={() => fetchUsers(meta.page)} aria-label="Refresh" />
        </Tooltip>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        pagination={{
          current: meta.page,
          pageSize: meta.limit,
          total: meta.total,
          showSizeChanger: false,
          showTotal: (total) => `${total} users`,
          onChange: (page) => fetchUsers(page),
        }}
      />

      <UserDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        editingUser={editingUser}
        roles={roles}
        loading={submitting}
      />

      <SendNotificationModal
        open={!!notifyUser}
        onClose={() => setNotifyUser(null)}
        endpoint={notifyUser ? `/users/${notifyUser.id}/send-notification` : undefined}
        title={`Send Notification${notifyUser ? ` — ${notifyUser.name}` : ''}`}
        successMessage={notifyUser ? `Notification sent to ${notifyUser.name}` : undefined}
      />

      <SendNotificationModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        endpoint="/notifications/broadcast"
        title="Notify All Users"
        description="This will be sent to all users. It cannot be undone or recalled."
        successMessage="Notification broadcast to all users"
      />
    </div>
  );
}
