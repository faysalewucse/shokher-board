import { useEffect, useState } from 'react';
import { Drawer, Form, Input, Switch, Checkbox, Button, Space, Divider, Tag } from 'antd';
import api from '@/services/api';

export default function RoleDrawer({ open, onClose, onSubmit, editingRole, loading }) {
  const [form] = Form.useForm();
  const isEdit = !!editingRole;
  const [permissionGroups, setPermissionGroups] = useState({});

  useEffect(() => {
    api.get('/permissions')
      .then(({ data }) => setPermissionGroups(data.data.groups))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (open) {
      if (editingRole) {
        form.setFieldsValue({
          name:        editingRole.name,
          description: editingRole.description || '',
          isDefault:   editingRole.isDefault || false,
          permissions: editingRole.permissions || [],
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ permissions: [], isDefault: false });
      }
    }
  }, [open, editingRole, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    onSubmit(values);
  };

  return (
    <Drawer
      title={isEdit ? 'Edit Role' : 'Create Role'}
      placement="right"
      width={720}
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Role'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Role Name" rules={[{ required: true, min: 2, message: 'Name is required' }]}>
          <Input placeholder="e.g. manager" size="large" />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea placeholder="What can this role do?" rows={2} />
        </Form.Item>

        <Form.Item name="isDefault" label="Default Role" valuePropName="checked">
          <Switch />
        </Form.Item>
        <p className="text-xs text-fg-3 -mt-3 mb-4">
          Automatically assigned to newly registered users.
        </p>

        <Divider orientation="left" orientationMargin={0}>
          <span className="eyebrow text-fg!">Permissions</span>
        </Divider>

        <Form.Item name="permissions">
          <Checkbox.Group className="w-full">
            {Object.entries(permissionGroups)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([group, items]) => (
              <div key={group} className="mb-5 w-full">
                <div className="flex items-center gap-2 mb-2.5 border-b border-line pb-1.5">
                  <span className="mono text-[11px] font-semibold text-fg uppercase tracking-[0.1em]">
                    {group}
                  </span>
                  <Tag
                    className="ml-auto! cursor-pointer select-none"
                    onClick={() => {
                      const keys = items.map((i) => i.key);
                      const current = form.getFieldValue('permissions') || [];
                      const allSelected = keys.every((k) => current.includes(k));
                      const next = allSelected
                        ? current.filter((p) => !keys.includes(p))
                        : [...new Set([...current, ...keys])];
                      form.setFieldValue('permissions', next);
                    }}
                  >
                    Toggle all
                  </Tag>
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 pl-1">
                  {items.map(({ key, description }) => (
                    <Checkbox key={key} value={key} style={{ alignItems: 'flex-start' }}>
                      <div style={{ lineHeight: 1.3 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--c-fg)', fontFamily: 'var(--ff-mono)' }}>{key}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--c-fg-2)', marginTop: 2 }}>{description}</div>
                      </div>
                    </Checkbox>
                  ))}
                </div>
              </div>
            ))}
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
