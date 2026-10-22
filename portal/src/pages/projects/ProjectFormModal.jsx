import { useEffect, useMemo, useState } from 'react';
import { Avatar, DatePicker, Divider, Form, Input, Modal, Segmented, Select, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import usePermission from '@/hooks/usePermission';
import useDebounce from '@/hooks/useDebounce';
import { lookupUsers, errorMessage } from '@/services/boards';
import { getClients, createClient } from '@/services/projects';
import { avatarSrc, initials } from '@/pages/boards/boardUtils';
import ClientFormModal from '@/pages/clients/ClientFormModal';
import { PROJECT_STATUSES, toDay, fromDay } from './projectUtils';

function UserOption({ user }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar
        size={20}
        shape="square"
        src={avatarSrc(user)}
        style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', fontSize: 9, fontWeight: 700, borderRadius: 3, flexShrink: 0 }}
      >
        {initials(user.name)}
      </Avatar>
      <span className="truncate">{user.name}</span>
      {user.email && <span className="truncate text-[11.5px] text-fg-3">{user.email}</span>}
    </span>
  );
}

/**
 * Create / edit a project. `initial` may be a full project (edit) or just
 * `{ clientId }` to pre-select a client. Clients come from GET /clients; a
 * 403 hides the picker. Owners come from GET /users/lookup.
 */
export default function ProjectFormModal({ open, onCancel, onSubmit, initial, title, okText }) {
  const [form] = Form.useForm();
  const canManageClients = usePermission('CLIENT_MANAGE');
  const editing = !!initial?.id;

  const [clients, setClients] = useState(null);
  const [clientsDenied, setClientsDenied] = useState(false);
  const [clientModal, setClientModal] = useState(false);

  const [userQuery, setUserQuery] = useState('');
  const debouncedUserQuery = useDebounce(userQuery, 300);
  const [users, setUsers] = useState([]);
  const [knownUsers, setKnownUsers] = useState({}); // id → user, so a picked owner keeps its label
  const [usersLoading, setUsersLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    getClients()
      .then((data) => !cancelled && setClients(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (cancelled) return;
        setClients([]);
        if (err?.response?.status === 403) setClientsDenied(true);
      });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setUsersLoading(true);
    lookupUsers(debouncedUserQuery, 20)
      .then((list) => {
        if (cancelled) return;
        setUsers(list || []);
        setKnownUsers((prev) => ({ ...prev, ...Object.fromEntries((list || []).map((u) => [u.id, u])) }));
      })
      .catch(() => !cancelled && setUsers([]))
      .finally(() => !cancelled && setUsersLoading(false));
    return () => { cancelled = true; };
  }, [open, debouncedUserQuery]);

  // Keep the current owner selectable even if the lookup page doesn't include them.
  const ownerId = Form.useWatch('ownerId', form);
  const userOptions = useMemo(() => {
    const list = [...users];
    const current = ownerId ? (knownUsers[ownerId] || (initial?.owner?.id === ownerId ? initial.owner : null)) : null;
    if (current && !list.some((u) => u.id === current.id)) list.unshift(current);
    return list.map((u) => ({ value: u.id, label: <UserOption user={u} /> }));
  }, [users, knownUsers, ownerId, initial]);

  const clientOptions = useMemo(() => {
    const list = [...(clients || [])];
    if (initial?.client && !list.some((c) => c.id === initial.client.id)) list.unshift(initial.client);
    return list.map((c) => ({
      value: c.id,
      search: `${c.name} ${c.company || ''}`,
      label: (
        <span>
          {c.name}
          {c.company && <span className="text-fg-3"> · {c.company}</span>}
        </span>
      ),
    }));
  }, [clients, initial]);

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        clientId: values.clientId || null,
        status: values.status,
        startDate: fromDay(values.startDate),
        deadline: fromDay(values.deadline),
        ...(values.ownerId ? { ownerId: values.ownerId } : editing ? { ownerId: null } : {}),
      });
      form.resetFields();
    } catch {
      // Caller already showed the error; keep the modal open.
    } finally {
      setSaving(false);
    }
  };

  const handleCreateClient = async (values) => {
    try {
      const client = await createClient(values);
      setClients((prev) => [...(prev || []), client].sort((a, b) => a.name.localeCompare(b.name)));
      form.setFieldValue('clientId', client.id);
      setClientModal(false);
      message.success('Client created');
    } catch (err) {
      message.error(errorMessage(err, 'Failed to create client'));
      throw err;
    }
  };

  return (
    <Modal
      title={title || (editing ? 'Edit project' : 'New project')}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={okText || (editing ? 'Save' : 'Create')}
      confirmLoading={saving}
      destroyOnHidden
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{
          name: initial?.name || '',
          description: initial?.description || '',
          clientId: initial?.clientId || undefined,
          status: initial?.status || 'planning',
          startDate: toDay(initial?.startDate),
          deadline: toDay(initial?.deadline),
          ownerId: initial?.ownerId || undefined,
        }}
        className="pt-2"
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: 'Project name is required' }]}>
          <Input placeholder="e.g. Website redesign" autoFocus maxLength={200} />
        </Form.Item>

        {!clientsDenied && (
          <Form.Item name="clientId" label="Client" extra="Optional — leave empty for an internal project.">
            <Select
              allowClear
              loading={clients === null}
              placeholder="No client (internal)"
              showSearch={{ optionFilterProp: 'search' }}
              options={clientOptions}
              popupRender={(menu) => (
                <>
                  {menu}
                  {canManageClients && (
                    <>
                      <Divider style={{ margin: '4px 0' }} />
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setClientModal(true)}
                        className="flex w-full items-center gap-2 rounded-sm border-0 bg-transparent px-3 py-1.5 text-left text-[13px] font-semibold text-fg hover:bg-surface-3"
                        style={{ cursor: 'pointer' }}
                      >
                        <PlusOutlined /> New client
                      </button>
                    </>
                  )}
                </>
              )}
            />
          </Form.Item>
        )}

        <Form.Item name="status" label="Status">
          <Segmented block options={PROJECT_STATUSES} />
        </Form.Item>

        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Form.Item name="startDate" label="Start date">
            <DatePicker className="w-full" format="MMM D, YYYY" placeholder="Not set" />
          </Form.Item>
          <Form.Item
            name="deadline"
            label="Deadline"
            dependencies={['startDate']}
            rules={[({ getFieldValue }) => ({
              validator(_, value) {
                const start = getFieldValue('startDate');
                if (!value || !start || !value.isBefore(start, 'day')) return Promise.resolve();
                return Promise.reject(new Error('Deadline can’t be before the start date'));
              },
            })]}
          >
            <DatePicker
              className="w-full"
              format="MMM D, YYYY"
              placeholder="Not set"
              disabledDate={(d) => {
                const start = form.getFieldValue('startDate');
                return !!start && d.isBefore(start, 'day');
              }}
            />
          </Form.Item>
        </div>

        <Form.Item name="ownerId" label="Owner" extra={editing ? null : 'Defaults to you if left empty.'}>
          <Select
            allowClear
            showSearch={{ filterOption: false, onSearch: setUserQuery }}
            loading={usersLoading}
            placeholder="Search people by name or email"
            options={userOptions}
            onBlur={() => setUserQuery('')}
          />
        </Form.Item>

        <Form.Item name="description" label="Description" className="mb-0">
          <Input.TextArea placeholder="Goals, scope, links…" autoSize={{ minRows: 3, maxRows: 8 }} />
        </Form.Item>
      </Form>

      {canManageClients && (
        <ClientFormModal
          open={clientModal}
          onCancel={() => setClientModal(false)}
          onSubmit={handleCreateClient}
        />
      )}
    </Modal>
  );
}
