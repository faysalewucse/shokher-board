import { useState } from 'react';
import { Button, Checkbox, Input, Popconfirm, Progress, Typography, message } from 'antd';
import { CheckSquareOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import {
  createChecklist, updateChecklist, deleteChecklist,
  createChecklistItem, updateChecklistItem, deleteChecklistItem, errorMessage,
} from '@/services/boards';
import { byPosition } from '../positions';

function AddItem({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const submit = async () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    await onAdd(v);
  };
  if (!open) {
    return (
      <Button size="small" type="text" icon={<PlusOutlined />} onClick={() => setOpen(true)} className="ml-6">
        Add an item
      </Button>
    );
  }
  return (
    <div className="ml-6 mt-1 flex gap-2">
      <Input
        size="small"
        autoFocus
        value={text}
        placeholder="Add an item"
        onChange={(e) => setText(e.target.value)}
        onPressEnter={submit}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
      />
      <Button size="small" type="primary" onClick={submit}>Add</Button>
      <Button size="small" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}

/**
 * Checklists section. `commit(fn)` applies an updater to the CardDetail and
 * syncs the board's card tile.
 */
export default function CardChecklists({ cardId, checklists = [], commit, canEdit }) {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const mapChecklist = (id, fn) => (d) => ({
    ...d,
    checklists: (d.checklists || []).map((c) => (c.id === id ? fn(c) : c)),
  });
  const mapItem = (checklistId, itemId, fn) => mapChecklist(checklistId, (c) => ({
    ...c,
    items: (c.items || []).map((i) => (i.id === itemId ? fn(i) : i)),
  }));

  const run = async (optimistic, call, rollback, errText) => {
    if (optimistic) commit(optimistic);
    try {
      return await call();
    } catch (err) {
      if (rollback) commit(rollback);
      message.error(errorMessage(err, errText));
      return null;
    }
  };

  const addChecklist = async () => {
    const title = newTitle.trim() || 'Checklist';
    setAdding(true);
    const res = await run(null, () => createChecklist(cardId, title), null, 'Failed to add checklist');
    setAdding(false);
    if (res?.id) {
      commit((d) => ({ ...d, checklists: [...(d.checklists || []), { ...res, items: res.items || [] }] }));
      setNewTitle('');
    }
  };

  const renameChecklist = (c, title) => run(
    mapChecklist(c.id, (x) => ({ ...x, title })),
    () => updateChecklist(c.id, { title }),
    mapChecklist(c.id, (x) => ({ ...x, title: c.title })),
    'Failed to rename checklist',
  );

  const removeChecklist = async (c) => {
    const ok = await run(null, () => deleteChecklist(c.id).then(() => true), null, 'Failed to delete checklist');
    if (ok) commit((d) => ({ ...d, checklists: d.checklists.filter((x) => x.id !== c.id) }));
  };

  const addItem = async (c, text) => {
    const res = await run(null, () => createChecklistItem(c.id, text), null, 'Failed to add item');
    if (res?.id) commit(mapChecklist(c.id, (x) => ({ ...x, items: [...(x.items || []), res] })));
  };

  const patchItem = (c, item, patch) => run(
    mapItem(c.id, item.id, (i) => ({ ...i, ...patch })),
    () => updateChecklistItem(item.id, patch),
    mapItem(c.id, item.id, () => item),
    'Failed to update item',
  );

  const removeItem = async (c, item) => {
    const ok = await run(null, () => deleteChecklistItem(item.id).then(() => true), null, 'Failed to delete item');
    if (ok) commit(mapChecklist(c.id, (x) => ({ ...x, items: x.items.filter((i) => i.id !== item.id) })));
  };

  const sorted = checklists.slice().sort(byPosition);

  return (
    <div className="flex flex-col gap-5">
      {sorted.map((c) => {
        const items = (c.items || []).slice().sort(byPosition);
        const done = items.filter((i) => i.isDone).length;
        const pct = items.length ? Math.round((done / items.length) * 100) : 0;
        return (
          <div key={c.id}>
            <div className="flex items-center gap-2">
              <CheckSquareOutlined className="text-fg" />
              <Typography.Text
                strong
                className="flex-1"
                editable={canEdit ? { onChange: (t) => t.trim() && t !== c.title && renameChecklist(c, t.trim()), triggerType: ['text'] } : false}
              >
                {c.title}
              </Typography.Text>
              {canEdit && (
                <Popconfirm title="Delete this checklist?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => removeChecklist(c)}>
                  <Button size="small" type="text" icon={<DeleteOutlined />} aria-label="Delete checklist" />
                </Popconfirm>
              )}
            </div>
            <div className="ml-6 flex items-center gap-2">
              <span className={`mono w-9 text-[11px] ${pct === 100 ? 'font-bold text-fg' : 'text-fg-3'}`}>{pct}%</span>
              <Progress percent={pct} showInfo={false} size="small" strokeLinecap="butt" className="m-0 flex-1" />
              {pct === 100 && <span className="mono-tag mono-tag--solid" style={{ height: 18, fontSize: 10 }}>DONE</span>}
            </div>
            <div className="mt-1 flex flex-col">
              {items.map((item) => (
                <div key={item.id} className="group flex items-start gap-2 rounded-sm px-1 py-0.5 transition-colors hover:bg-surface-2">
                  <Checkbox
                    checked={item.isDone}
                    disabled={!canEdit}
                    onChange={(e) => patchItem(c, item, { isDone: e.target.checked })}
                    className="mt-0.5"
                  />
                  <Typography.Text
                    className="flex-1 text-[13px]"
                    delete={item.isDone}
                    type={item.isDone ? 'secondary' : undefined}
                    editable={canEdit ? { onChange: (t) => t.trim() && t !== item.text && patchItem(c, item, { text: t.trim() }), triggerType: ['text'] } : false}
                  >
                    {item.text}
                  </Typography.Text>
                  {canEdit && (
                    <Button
                      size="small"
                      type="text"
                      icon={<DeleteOutlined />}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label="Delete item"
                      onClick={() => removeItem(c, item)}
                    />
                  )}
                </div>
              ))}
            </div>
            {canEdit && <AddItem onAdd={(text) => addItem(c, text)} />}
          </div>
        );
      })}

      {canEdit && (
        <div className="flex gap-2">
          <Input
            size="small"
            placeholder="New checklist title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onPressEnter={addChecklist}
            style={{ maxWidth: 260 }}
          />
          <Button size="small" icon={<PlusOutlined />} loading={adding} onClick={addChecklist}>
            Add checklist
          </Button>
        </div>
      )}
    </div>
  );
}
