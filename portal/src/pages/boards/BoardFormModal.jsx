import { useEffect, useState } from 'react';
import { Form, Input, Modal, Select, Tooltip } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { getProjects } from '@/services/boards';
import {
  BOARD_COLORS, BOARD_SURFACE_NAMES, DEFAULT_BOARD_COLOR, boardSurfaceClass,
} from './boardUtils';

/** Monochrome board backdrops — still stores the original colour values. */
function Swatches({ value, onChange }) {
  return (
    <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Board backdrop">
      {BOARD_COLORS.map((c, i) => {
        const selected = value === c;
        return (
          <Tooltip key={c} title={BOARD_SURFACE_NAMES[i]}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={BOARD_SURFACE_NAMES[i]}
              onClick={() => onChange?.(c)}
              className={`flex h-10 items-center justify-center rounded-sm border border-line text-fg transition-transform duration-150 hover:-translate-y-0.5 ${boardSurfaceClass(c)}`}
              style={{
                border: 'none',
                cursor: 'pointer',
                outline: selected ? '2px solid var(--c-fg)' : '1px solid var(--c-line)',
                outlineOffset: selected ? 2 : 0,
              }}
            >
              {selected && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-fg text-[11px] text-surface">
                  <CheckOutlined />
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

/**
 * Create / edit a board. Projects come from GET /projects; a 403 (no
 * PROJECT_READ) just hides the picker.
 */
export default function BoardFormModal({ open, onCancel, onSubmit, initial, title = 'Create board', okText = 'Create' }) {
  const [form] = Form.useForm();
  const [projects, setProjects] = useState(null); // null = loading, [] = none
  const [projectsDenied, setProjectsDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    getProjects()
      .then((data) => !cancelled && setProjects(Array.isArray(data) ? data : data?.items || []))
      .catch((err) => {
        if (cancelled) return;
        setProjects([]);
        if (err?.response?.status === 403) setProjectsDenied(true);
      });
    return () => { cancelled = true; };
  }, [open]);

  const handleOk = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        color: values.color,
        projectId: values.projectId || null,
      });
      form.resetFields();
    } catch {
      // The caller already surfaced the error; keep the modal open.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      okText={okText}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        initialValues={{
          name: initial?.name || '',
          description: initial?.description || '',
          color: initial?.color || DEFAULT_BOARD_COLOR,
          projectId: initial?.projectId || undefined,
        }}
        className="pt-2"
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: 'Board name is required' }]}>
          <Input placeholder="e.g. Website redesign" autoFocus maxLength={120} />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input.TextArea placeholder="What is this board for?" autoSize={{ minRows: 2, maxRows: 5 }} />
        </Form.Item>
        <Form.Item name="color" label="Backdrop">
          <Swatches />
        </Form.Item>
        {!projectsDenied && (
          <Form.Item
            name="projectId"
            label="Project"
            extra="Optional — leave empty for a standalone board."
          >
            <Select
              allowClear
              loading={projects === null}
              placeholder="No project (standalone)"
              showSearch={{ optionFilterProp: 'search' }}
              options={(projects || []).map((p) => ({
                value: p.id,
                search: `${p.name} ${p.client?.name || ''}`,
                label: (
                  <span>
                    {p.name}
                    {p.client?.name && <span className="text-fg-3"> · {p.client.name}</span>}
                  </span>
                ),
              }))}
            />
          </Form.Item>
        )}
        {projectsDenied && (
          <Tooltip title="You don't have access to projects">
            <div className="text-[12px] text-fg-3">This board will be standalone.</div>
          </Tooltip>
        )}
      </Form>
    </Modal>
  );
}
