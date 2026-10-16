import { useEffect, useState } from 'react';
import {
  Card, Form, Input, Button, Avatar, Upload, Row, Col, Divider,
  Typography, message, Descriptions, Space,
} from 'antd';
import {
  UserOutlined, MailOutlined, PhoneOutlined, SafetyOutlined,
  CameraOutlined, LockOutlined, SaveOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import { getImageUrl } from '@/utils/imageUrl';
import { useAuth } from '@/context/AuthContext';
import { StatusTag } from '@/components/MonoTag';
import ConnectedApps from '@/components/slack/ConnectedApps';

const { Title, Text } = Typography;

const formatRoleName = (name) => {
  if (!name) return 'No role';
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

export default function Profile() {
  const { user, setUser, refreshMe } = useAuth();
  const [profileForm]  = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [savingProfile, setSavingProfile]   = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading]           = useState(false);

  useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        name:  user.name  || '',
        phone: user.phone || '',
      });
    }
  }, [user, profileForm]);

  // ── Editable details (name, phone) ──────────────────────────────────────────
  const handleProfileSave = async () => {
    const values = await profileForm.validateFields();
    setSavingProfile(true);
    try {
      const res = await api.patch('/users/me', {
        name:  values.name,
        phone: values.phone || '',
      });
      const updated = res.data?.data?.user;
      if (updated) setUser((prev) => ({ ...prev, ...updated }));
      message.success('Profile updated successfully');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Avatar upload ───────────────────────────────────────────────────────────
  const handleAvatarUpload = async (file) => {
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
      message.error('Please upload an image file');
      return Upload.LIST_IGNORE;
    }
    if (file.size / 1024 / 1024 > 5) {
      message.error('Image must be smaller than 5MB');
      return Upload.LIST_IGNORE;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res.data?.data?.user;
      if (updated) setUser((prev) => ({ ...prev, ...updated }));
      else await refreshMe();
      message.success('Photo updated');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update photo');
    } finally {
      setUploading(false);
    }
    return Upload.LIST_IGNORE; // prevent antd from managing the file list
  };

  // ── Change password ─────────────────────────────────────────────────────────
  const handlePasswordChange = async () => {
    const values = await passwordForm.validateFields();
    setSavingPassword(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword: values.currentPassword,
        newPassword:     values.newPassword,
      });
      message.success('Password changed successfully');
      passwordForm.resetFields();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Row gutter={16}>
        {/* Left: identity card */}
        <Col xs={24} md={8}>
          <Card className="rise" style={{ borderRadius: 6, textAlign: 'center', overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div className="grid-backdrop" style={{ height: 72 }} />
            <div style={{ padding: '0 24px 24px', marginTop: -48 }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Avatar
                size={96}
                shape="square"
                src={user.avatar ? getImageUrl(user.avatar) : undefined}
                icon={<UserOutlined />}
                style={{ backgroundColor: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', borderRadius: 6, border: '3px solid var(--c-surface)' }}
              />
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={handleAvatarUpload}
                disabled={uploading}
              >
                <Button
                  shape="circle"
                  size="small"
                  icon={<CameraOutlined />}
                  loading={uploading}
                  aria-label="Change photo"
                  style={{ position: 'absolute', bottom: -4, right: -4 }}
                />
              </Upload>
            </div>

            <Title level={4} style={{ marginTop: 16, marginBottom: 6 }}>{user.name}</Title>
            <div style={{ marginBottom: 8 }}><StatusTag status={user.status} /></div>

            <Divider style={{ margin: '12px 0' }} />

            <Descriptions column={1} size="small" colon={false} styles={{ label: { color: 'var(--c-fg-3)' } }}>
              <Descriptions.Item label={<><MailOutlined /> Email</>}>{user.email}</Descriptions.Item>
              <Descriptions.Item label={<><SafetyOutlined /> Role</>}>{formatRoleName(user.role?.name)}</Descriptions.Item>
            </Descriptions>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Email and role are managed by an administrator.
            </Text>
            </div>
          </Card>
        </Col>

        {/* Right: editable details + password */}
        <Col xs={24} md={16}>
          <Card
            title="Edit Details"
            className="rise rise-1"
            style={{ borderRadius: 6, marginBottom: 16 }}
            styles={{ body: { padding: 24 } }}
          >
            <Form form={profileForm} layout="vertical" requiredMark="optional">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="name"
                    label="Full Name"
                    rules={[{ required: true, min: 2, message: 'Name is required' }]}
                  >
                    <Input prefix={<UserOutlined />} placeholder="John Doe" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Phone">
                    <Input prefix={<PhoneOutlined />} placeholder="+1 555 000 0000" />
                  </Form.Item>
                </Col>
              </Row>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={savingProfile}
                  onClick={handleProfileSave}
                >
                  Save Changes
                </Button>
              </Space>
            </Form>
          </Card>

          <Card
            title="Change Password"
            className="rise rise-2"
            style={{ borderRadius: 6 }}
            styles={{ body: { padding: 24 } }}
          >
            <Form form={passwordForm} layout="vertical" requiredMark="optional">
              <Form.Item
                name="currentPassword"
                label="Current Password"
                rules={[{ required: true, message: 'Enter your current password' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="Current password" />
              </Form.Item>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="newPassword"
                    label="New Password"
                    rules={[{ required: true, min: 6, message: 'Min. 6 characters' }]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="New password" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="confirmPassword"
                    label="Confirm New Password"
                    dependencies={['newPassword']}
                    rules={[
                      { required: true, message: 'Confirm your new password' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                          return Promise.reject(new Error('Passwords do not match'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="Re-enter new password" />
                  </Form.Item>
                </Col>
              </Row>
              <Space>
                <Button
                  type="primary"
                  icon={<LockOutlined />}
                  loading={savingPassword}
                  onClick={handlePasswordChange}
                >
                  Update Password
                </Button>
              </Space>
            </Form>
          </Card>

          <div style={{ marginTop: 16 }}>
            <ConnectedApps />
          </div>
        </Col>
      </Row>
    </div>
  );
}
