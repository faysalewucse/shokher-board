import { useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { ExclamationCircleFilled } from '@ant-design/icons';
import api from '@/services/api';

const { TextArea } = Input;

/**
 * Shared modal for both per-user notifications and the "notify all" broadcast.
 * The caller decides which by passing `endpoint`/`title`/`successMessage`.
 */
export default function SendNotificationModal({ open, onClose, endpoint, title, successMessage, description }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) form.resetFields();
  }, [open, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const { data } = await api.post(endpoint, values);
      message.success(data?.message || successMessage);
      onClose();
    } catch (err) {
      if (err.errorFields) return; // form validation error, already shown inline
      message.error(err.response?.data?.message || 'Failed to send notification');
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="Send"
      destroyOnClose
    >
      {description && (
        <p className="mb-4 flex items-start gap-2 rounded-md border border-fg px-3 py-2 text-[13px] font-semibold text-fg">
          <ExclamationCircleFilled className="mt-0.5" />
          <span>{description}</span>
        </p>
      )}
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="Title"
          rules={[{ required: true, message: 'Title is required' }, { max: 100 }]}
        >
          <Input placeholder="e.g. Scheduled maintenance tonight" maxLength={100} showCount />
        </Form.Item>
        <Form.Item
          name="body"
          label="Message"
          rules={[{ required: true, message: 'Message is required' }, { max: 500 }]}
        >
          <TextArea rows={4} placeholder="Notification message" maxLength={500} showCount />
        </Form.Item>
        <Form.Item
          name="actionUrl"
          label="Action URL (optional)"
          extra="If set, clicking the notification opens this link."
          rules={[{ type: 'url', message: 'Must be a valid URL' }]}
        >
          <Input placeholder="https://…" allowClear />
        </Form.Item>
      </Form>
    </Modal>
  );
}
