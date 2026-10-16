import { useState } from 'react';
import { Button, Input } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';

/**
 * Trello-style "+ Add a card" / "+ Add another list" composer.
 * Stays open after submit so several items can be added in a row.
 */
export default function InlineComposer({
  triggerLabel, placeholder, submitLabel, onSubmit, variant = 'card', className = '',
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await onSubmit(value);
      setText('');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] font-medium transition-colors ${
          variant === 'list'
            ? 'border border-dashed border-line-2 bg-surface/60 py-2.5 text-fg-2 hover:border-line-strong hover:bg-surface hover:text-fg'
            : 'text-fg-2 hover:bg-gray-200 hover:text-fg'
        } ${className}`}
        style={{ cursor: 'pointer', ...(variant === 'list' ? {} : { border: 'none', background: 'transparent' }) }}
      >
        <PlusOutlined /> {triggerLabel}
      </button>
    );
  }

  return (
    <div className={`rounded-md ${variant === 'list' ? 'border border-line bg-surface-3 p-2' : ''} ${className}`}>
      <Input.TextArea
        autoFocus
        value={text}
        placeholder={placeholder}
        autoSize={{ minRows: variant === 'card' ? 2 : 1, maxRows: 6 }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        style={{ fontSize: 13 }}
      />
      <div className="mt-2 flex items-center gap-1">
        <Button type="primary" size="small" loading={busy} onClick={submit}>
          {submitLabel}
        </Button>
        <Button type="text" size="small" icon={<CloseOutlined />} onClick={() => { setOpen(false); setText(''); }} />
      </div>
    </div>
  );
}
