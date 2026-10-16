import { useState } from 'react';
import { Button, Input, Modal, Popconfirm, Tooltip, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { createLabel, updateLabel, deleteLabel, errorMessage } from '@/services/boards';
import { useBoard } from './boardState';
import { LABEL_COLOR_OPTIONS, LABEL_STYLES } from './boardUtils';
import { LabelChip, LabelSwatch } from './BoardChips';
import MonoEmpty from '@/components/MonoEmpty';

/** Pick a monochrome label style; stores the original colour name. */
function ColorPicker({ value, onChange, disabled }) {
  return (
    <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Label style">
      {LABEL_COLOR_OPTIONS.map((c) => {
        const selected = value === c;
        return (
          <Tooltip key={c} title={LABEL_STYLES[c].name}>
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={LABEL_STYLES[c].name}
              disabled={disabled}
              onClick={() => onChange(c)}
              className="flex h-7 w-8 items-center justify-center rounded-sm transition-colors"
              style={{
                background: 'transparent',
                border: selected ? '1.5px solid var(--c-fg)' : '1.5px solid transparent',
                cursor: disabled ? 'default' : 'pointer',
                padding: 0,
              }}
            >
              <LabelSwatch color={c} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function LabelRow({ label, isOwner, dispatch }) {
  const [name, setName] = useState(label.name);

  const save = async (patch) => {
    const prev = label;
    dispatch({ type: 'label/upsert', label: { ...label, ...patch } });
    try {
      await updateLabel(label.id, patch);
    } catch (err) {
      dispatch({ type: 'label/upsert', label: prev });
      message.error(errorMessage(err, 'Failed to update label'));
    }
  };

  const remove = async () => {
    try {
      await deleteLabel(label.id);
      dispatch({ type: 'label/remove', id: label.id });
    } catch (err) {
      message.error(errorMessage(err, 'Failed to delete label'));
    }
  };

  return (
    <div className="flex flex-col gap-1.5 border-b border-line py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-28 shrink-0">
        <LabelChip label={label} size="md">{label.name || '\u00a0'}</LabelChip>
      </span>
      {isOwner ? (
        <>
          <Input
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== label.name && save({ name: name.trim() })}
            onPressEnter={(e) => e.currentTarget.blur()}
            style={{ maxWidth: 160 }}
          />
          <ColorPicker value={label.color} onChange={(color) => save({ color })} />
          <Popconfirm title="Delete this label? It is removed from all cards." okText="Delete" okButtonProps={{ danger: true }} onConfirm={remove}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} className="sm:ml-auto" aria-label="Delete label" />
          </Popconfirm>
        </>
      ) : null}
    </div>
  );
}

export default function LabelsModal({ open, onClose }) {
  const { state, dispatch, isOwner, boardId } = useBoard();
  const [name, setName] = useState('');
  const [color, setColor] = useState('black');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const label = await createLabel(boardId, { name: name.trim(), color });
      if (label?.id) dispatch({ type: 'label/upsert', label });
      setName('');
    } catch (err) {
      message.error(errorMessage(err, 'Failed to create label'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Labels" open={open} onCancel={onClose} footer={null} width={620} destroyOnHidden>
      {isOwner && (
        <div className="mb-3 flex flex-col gap-2.5 rounded-md border border-line bg-surface-2 p-3">
          <div className="eyebrow">New label</div>
          <div className="flex gap-2">
            <Input
              placeholder="New label name (no spaces works best for #tags)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onPressEnter={add}
            />
            <Button type="primary" icon={<PlusOutlined />} loading={busy} onClick={add}>Add</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ColorPicker value={color} onChange={setColor} />
            <span className="ml-auto"><LabelChip color={color} size="md">{name.trim() || 'Preview'}</LabelChip></span>
          </div>
        </div>
      )}
      {state.labels.length === 0 ? (
        <MonoEmpty compact description="No labels yet" />
      ) : (
        state.labels.map((l) => <LabelRow key={l.id} label={l} isOwner={isOwner} dispatch={dispatch} />)
      )}
    </Modal>
  );
}
