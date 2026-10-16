import { useEffect, useMemo } from 'react';
import { Drawer, Form, Input, Select, Button, Space, Row, Col } from 'antd';

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Pending', value: 'pending' },
];

// "super_admin" → "Super Admin"
const formatRoleName = (name) => {
  if (!name) return '';
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export default function UserDrawer({ open, onClose, onSubmit, editingUser, roles, loading }) {
  const [form] = Form.useForm();
  const isEdit = !!editingUser;

  const roleOptions = useMemo(() => {
    if (!roles || !Array.isArray(roles)) return [];
    return roles.map((r) => ({ label: formatRoleName(r.name), value: r.id }));
  }, [roles]);

  useEffect(() => {
    if (open) {
      if (editingUser) {
        form.setFieldsValue({
          name: editingUser.name,
          email: editingUser.email,
          phone: editingUser.phone || '',
          status: editingUser.status,
          role: editingUser.role?.id || null,
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingUser, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    onSubmit(values);
  };

  return (
    <Drawer
      title={isEdit ? 'Edit User' : 'Add User'}
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      extra={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" size="middle" requiredMark="optional">
        <Form.Item name="name" label="Full Name" rules={[{ required: true, min: 2, message: 'Name is required' }]}>
          <Input placeholder="John Doe" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={isEdit ? 24 : 12}>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}
            >
              <Input placeholder="john@example.com" disabled={isEdit} />
            </Form.Item>
          </Col>
          {!isEdit && (
            <Col span={12}>
              <Form.Item
                name="password"
                label="Password"
                rules={[{ required: true, min: 6, message: 'Min 6 chars' }]}
              >
                <Input.Password placeholder="Min. 6 characters" />
              </Form.Item>
            </Col>
          )}
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="phone" label="Phone">
              <Input placeholder="+1 555 000 0000" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
              <Select options={STATUS_OPTIONS} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="role" label="Role">
          <Select
            placeholder="Select a role"
            allowClear
            showSearch
            optionFilterProp="label"
            options={roleOptions}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
