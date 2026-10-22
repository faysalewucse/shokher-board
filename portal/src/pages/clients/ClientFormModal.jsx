import { useState } from 'react';
import { Form, Input, Modal } from 'antd';

const clean = (v) => (typeof v === 'string' ? v.trim() || null : v ?? null);

/**
 * Create / edit a client. `onSubmit(values)` should throw to keep the modal
 * open (the caller surfaces the error).
 */
export default function ClientFormModal({ open, onCancel, onSubmit, initial, title, okText }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const editing = !!initial?.id;

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        company: clean(values.company),
        email: clean(values.email),
        phone: clean(values.phone),
        notes: clean(values.notes),
      });
      form.resetFields();
    } catch {
      // Caller already showed the error; keep the modal open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title || (editing ? 'Edit client' : 'New client')}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={okText || (editing ? 'Save' : 'Create')}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{
          name: initial?.name || '',
          company: initial?.company || '',
          email: initial?.email || '',
          phone: initial?.phone || '',
          notes: initial?.notes || '',
        }}
        className="pt-2"
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: 'Client name is required' }]}>
          <Input placeholder="e.g. Jane Rahman" autoFocus maxLength={200} />
        </Form.Item>
        <Form.Item name="company" label="Company">
          <Input placeholder="e.g. Acme Ltd." maxLength={200} />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}>
            <Input placeholder="name@company.com" maxLength={255} />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="+880 1XXX-XXXXXX" maxLength={50} />
          </Form.Item>
        </div>
        <Form.Item name="notes" label="Notes" className="mb-0">
          <Input.TextArea placeholder="Anything the team should know about this client" autoSize={{ minRows: 3, maxRows: 8 }} maxLength={10000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
