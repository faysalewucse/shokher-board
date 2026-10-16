import { memo } from 'react';
import { Avatar, Tooltip } from 'antd';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlignLeftOutlined,
  CommentOutlined,
  PaperClipOutlined,
  CheckSquareOutlined,
  MessageOutlined,
  CheckCircleFilled,
  ArrowUpOutlined,
  ExclamationOutlined,
} from '@ant-design/icons';
import {
  avatarSrc, initials, priorityMeta, isMessageCard,
} from './boardUtils';
import { LabelChip, DueBadge } from './BoardChips';

/** Priority without colour: urgent = solid, high = dark-gray fill, medium = outline, low = muted text. */
const PRIORITY_LOOK = {
  urgent: { cls: 'meta-badge--solid', icon: <ExclamationOutlined /> },
  high: { cls: 'meta-badge--strong', icon: <ArrowUpOutlined /> },
  medium: { cls: 'meta-badge--outline' },
  low: { cls: '' },
};

function Badge({ icon, children, title, className = '' }) {
  return (
    <Tooltip title={title}>
      <span className={`meta-badge ${className}`}>
        {icon}
        {children}
      </span>
    </Tooltip>
  );
}

/** Pure presentational tile — also used inside the DragOverlay. */
export const CardTile = memo(function CardTile({ card, labelsById, onClick, dragging, overlay }) {
  const counts = card.counts || {};
  const labels = (card.labelIds || []).map((id) => labelsById?.[id]).filter(Boolean);
  const prio = priorityMeta(card.priority);
  const done = !!card.completedAt;
  const checklistDone = counts.checklistItems > 0 && counts.checklistDone === counts.checklistItems;

  return (
    <div
      onClick={onClick}
      className={`card-tile group cursor-pointer px-2.5 py-2 text-left ${overlay ? 'card-tile--overlay' : ''}`}
      style={{ opacity: dragging ? 0.3 : 1, outline: 'none' }}
    >
      {labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {labels.map((l) => <LabelChip key={l.id} label={l} />)}
        </div>
      )}

      <div className="flex items-start gap-1.5">
        {done && <CheckCircleFilled style={{ color: 'var(--c-fg)', marginTop: 3 }} aria-label="Completed" />}
        <div
          className="flex-1 break-words text-[13px] font-medium leading-5"
          style={{
            color: done ? 'var(--c-fg-3)' : 'var(--c-fg)',
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {card.title}
        </div>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1">
        {prio && (
          <Badge title={`Priority: ${prio.label}`} icon={PRIORITY_LOOK[prio.value]?.icon} className={PRIORITY_LOOK[prio.value]?.cls}>
            {prio.label}
          </Badge>
        )}
        {card.dueDate && (
          <Tooltip title={done ? 'Completed' : 'Due date'}>
            <span><DueBadge dueDate={card.dueDate} completedAt={card.completedAt} /></span>
          </Tooltip>
        )}
        {card.hasDescription && <Badge title="Has description" icon={<AlignLeftOutlined />} />}
        {counts.comments > 0 && <Badge title="Comments" icon={<CommentOutlined />}>{counts.comments}</Badge>}
        {counts.attachments > 0 && <Badge title="Attachments" icon={<PaperClipOutlined />}>{counts.attachments}</Badge>}
        {counts.checklistItems > 0 && (
          <Badge
            title={checklistDone ? 'Checklist complete' : 'Checklist items'}
            icon={<CheckSquareOutlined />}
            className={checklistDone ? 'meta-badge--outline meta-badge--bold' : ''}
          >
            {counts.checklistDone}/{counts.checklistItems}
          </Badge>
        )}
        {isMessageCard(card) && <Badge title="Created via message" icon={<MessageOutlined />} />}

        {card.assignees?.length > 0 && (
          <div className="ml-auto">
            <Avatar.Group size={22} max={{ count: 3, style: { fontSize: 10, background: 'var(--c-surface-3)', color: 'var(--c-fg)' } }}>
              {card.assignees.map((u) => (
                <Tooltip key={u.id} title={u.name}>
                  <Avatar size={22} src={avatarSrc(u)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', fontSize: 10 }}>
                    {initials(u.name)}
                  </Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
          </div>
        )}
      </div>
    </div>
  );
});

/** Sortable wrapper used inside a list. */
export function SortableCard({ card, labelsById, onOpen, disabled }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', listId: card.listId },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <CardTile card={card} labelsById={labelsById} dragging={isDragging} onClick={() => onOpen(card.id)} />
    </div>
  );
}

export default CardTile;
