import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space,
  Tooltip, message,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined, SafetyOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import usePermission from '@/hooks/usePermission';
import RoleDrawer from './RoleDrawer';
import PageHeader from '@/components/PageHeader';
import RowActions from '@/components/RowActions';
import MonoTag, { CountPill } from '@/components/MonoTag';
import { MonoArt } from '@/components/MonoEmpty';

export default function Roles() {
  const canRead   = usePermission('ROLE_READ');
  const canCreate = usePermission('ROLE_CREATE');
  const canUpdate = usePermission('ROLE_UPDATE');
  const canDelete = usePermission('ROLE_DELETE');

  const [roles, setRoles]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);

  const fetchRoles = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    try {
      const { data } = await api.get('/roles');
      setRoles(data.data);
    } catch {
      message.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const openCreate = () => { setEditingRole(null); setDrawerOpen(true); };
  const openEdit   = (role) => { setEditingRole(role); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditingRole(null); };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      if (editingRole) {
        await api.patch(`/roles/${editingRole.id}`, values);
        message.success('Role updated');
      } else {
        await api.post('/roles', values);
        message.success('Role created');
      }
      closeDrawer();
      fetchRoles();
    } catch (err) {
      message.error(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/roles/${id}`);
      message.success('Role deleted');
      fetchRoles();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const columns = [
    {
      title: 'Role',
      key: 'role',
      render: (_, record) => (
        <Space>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] border border-line text-fg">
            <SafetyOutlined />
          </span>
          <div>
            <div className="font-semibold capitalize text-fg">{record.name}</div>
            {record.description && (
              <div className="text-xs text-fg-3">{record.description}</div>
            )}
          </div>
          {record.isDefault && <MonoTag variant="solid">Default</MonoTag>}
        </Space>
      ),
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions) => (
        <CountPill value={permissions?.length || 0} muted={!permissions?.length} />
      ),
    },
    {
      title: 'Created',
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
          deleteConfirmTitle="Delete this role?"
          deleteConfirmDescription="Users assigned to this role will lose it."
        />
      ),
    },
  ];

  if (!canRead) {
    return (
      <div className="panel flex h-64 flex-col items-center justify-center gap-2 text-fg-2">
        <MonoArt kind="403" size={96} />
        <span className="font-semibold">You do not have permission to view roles.</span>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        count={roles.length}
        icon={<SafetyOutlined />}
        actions={
          <Space>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={fetchRoles} aria-label="Refresh" />
            </Tooltip>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Add Role
              </Button>
            )}
          </Space>
        }
      />

      <Table
        rowKey="id"
        columns={columns}
        dataSource={roles}
        loading={loading}
        pagination={false}
      />

      <RoleDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        onSubmit={handleSubmit}
        editingRole={editingRole}
        loading={submitting}
      />
    </div>
  );
}
