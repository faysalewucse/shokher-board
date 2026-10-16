import { useState } from 'react';
import { Dropdown, Input, Modal, Tooltip } from 'antd';
import { EllipsisOutlined, InboxOutlined } from '@ant-design/icons';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { SortableCard } from './CardTile';
import InlineComposer from './InlineComposer';
import { LIST_WIDTH, listDndId, dropDndId } from './dndIds';


function ListTitle({ list, canEdit, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(list.name);

  if (editing) {
    const commit = () => {
      setEditing(false);
      const v = value.trim();
      if (v && v !== list.name) onRename(list.id, v);
      else setValue(list.name);
    };
    return (
      <Input
        size="small"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onPressEnter={commit}
        onKeyDown={(e) => e.key === 'Escape' && (setValue(list.name), setEditing(false))}
        onPointerDown={(e) => e.stopPropagation()}
        style={{ fontWeight: 600 }}
      />
    );
  }

  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1.5 px-1 font-display text-[13px] font-bold tracking-tight text-fg"
      style={{ cursor: canEdit ? 'pointer' : 'default' }}
      title={canEdit ? 'Click to rename' : undefined}
      onClick={() => canEdit && (setValue(list.name), setEditing(true))}
    >
      {list.isInbox && (
        <Tooltip title="Inbox — messages land here by default">
          <InboxOutlined style={{ color: 'var(--c-fg-2)' }} />
        </Tooltip>
      )}
      <span className="truncate">{list.name}</span>
    </div>
  );
}

/**
 * One list column. The header is the drag handle for reordering lists; the
 * body is a droppable so cards can be dropped into empty lists.
 */
export default function ListColumn({
  list, cards, labelsById, canEdit, onOpenCard, onAddCard, onRenameList, onArchiveList, overlay,
}) {
  const sortable = useSortable({
    id: listDndId(list.id),
    data: { type: 'list', listId: list.id },
    disabled: !canEdit || overlay,
  });
  const { setNodeRef: setDropRef } = useDroppable({
    id: dropDndId(list.id),
    data: { type: 'list-drop', listId: list.id },
    disabled: !canEdit || overlay,
  });

  const style = overlay
    ? { transform: 'rotate(2deg)', boxShadow: 'var(--shadow-hard-lg)', borderColor: 'var(--c-fg)' }
    : {
      transform: CSS.Translate.toString(sortable.transform),
      transition: sortable.transition,
      opacity: sortable.isDragging ? 0.4 : 1,
    };

  const menu = {
    items: [
      list.isInbox
        ? { key: 'archive', label: 'Inbox can’t be archived', disabled: true }
        : { key: 'archive', label: 'Archive list', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'archive') {
        Modal.confirm({
          title: `Archive "${list.name}"?`,
          content: `The list and its ${cards.length} card(s) will be archived.`,
          okText: 'Archive',
          okButtonProps: { danger: true, type: 'primary' },
          onOk: () => onArchiveList(list.id),
        });
      }
    },
  };

  return (
    <div
      ref={overlay ? undefined : sortable.setNodeRef}
      className="flex max-h-full shrink-0 flex-col rounded-md"
      style={{ width: LIST_WIDTH, background: 'var(--c-surface-3)', border: '1px solid var(--c-line)', ...style }}
    >
      <div
        className="flex items-center gap-1 px-2 pb-1 pt-2"
        style={{ cursor: canEdit ? 'grab' : 'default' }}
        {...(canEdit && !overlay ? sortable.attributes : {})}
        {...(canEdit && !overlay ? sortable.listeners : {})}
      >
        <ListTitle list={list} canEdit={canEdit} onRename={onRenameList} />
        <span className="mono inline-flex h-5 min-w-[22px] items-center justify-center rounded-sm border border-line-2 px-1 text-[11px] font-semibold text-fg-2">
          {cards.length}
        </span>
        {canEdit && (
          <Dropdown menu={menu} trigger={['click']} placement="bottomRight">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="List actions"
              className="flex h-7 w-7 items-center justify-center rounded-sm text-fg-2 transition-colors hover:bg-gray-200 hover:text-fg"
              style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <EllipsisOutlined />
            </button>
          </Dropdown>
        )}
      </div>

      <div
        ref={setDropRef}
        className="flex min-h-[8px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-1 pt-1"
        style={{ overscrollBehavior: 'contain' }}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              labelsById={labelsById}
              onOpen={onOpenCard}
              disabled={!canEdit}
            />
          ))}
        </SortableContext>
      </div>

      {canEdit && !overlay && (
        <div className="px-2 pb-2 pt-1">
          <InlineComposer
            triggerLabel="Add a card"
            placeholder="Enter a title for this card…"
            submitLabel="Add card"
            onSubmit={(title) => onAddCard(list.id, title)}
          />
        </div>
      )}
    </div>
  );
}
