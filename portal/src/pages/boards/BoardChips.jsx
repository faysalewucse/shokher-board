import {
  CheckOutlined, ClockCircleOutlined, ExclamationCircleFilled, CalendarOutlined,
} from '@ant-design/icons';
import { labelStyle, dueStatus, formatDue } from './boardUtils';

/**
 * Monochrome label chip. The stored colour picks a style
 * (solid / graphite / tint / outline / dashed / dotted / double / hatched / dot / ring).
 */
export function LabelChip({ label, color, children, size = 'sm', title, className = '' }) {
  const { style } = labelStyle(color ?? label?.color);
  const text = children ?? label?.name;
  const hasMark = style === 'dot' || style === 'ring';
  return (
    <span
      className={`label-chip label-chip--${style} ${size === 'md' ? 'label-chip--md' : ''} ${className}`}
      title={title ?? label?.name}
    >
      {hasMark && <span className="label-chip__mark" />}
      {text ? <span className="truncate">{text}</span> : null}
    </span>
  );
}

/** Tiny style sample (used in pickers / dropdown options). */
export function LabelSwatch({ color }) {
  const { style } = labelStyle(color);
  const hasMark = style === 'dot' || style === 'ring';
  return (
    <span className={`label-chip label-chip--${style}`} style={{ width: 22, minWidth: 22, padding: 0, justifyContent: 'center' }}>
      {hasMark && <span className="label-chip__mark" />}
    </span>
  );
}

const DUE_LOOK = {
  done: { cls: 'meta-badge--done', icon: <CheckOutlined /> },
  soon: { cls: 'meta-badge--outline meta-badge--bold', icon: <ClockCircleOutlined /> },
  overdue: { cls: 'meta-badge--solid', icon: <ExclamationCircleFilled /> },
  later: { cls: '', icon: <CalendarOutlined /> },
};

/**
 * Due badge without colour:
 *   completed — outlined, check icon, struck-through muted date
 *   due <24h  — outlined + bold, clock icon
 *   overdue   — solid black fill, white text, alert icon
 */
export function DueBadge({ dueDate, completedAt, format = formatDue, suffix = false }) {
  const due = dueStatus(dueDate, completedAt);
  if (!due) return null;
  const look = DUE_LOOK[due.key];
  return (
    <span className={`meta-badge ${look.cls}`} title={due.label} aria-label={`${due.label}: ${format(dueDate)}`}>
      {look.icon}
      <span className="meta-badge__text">{format(dueDate)}</span>
      {suffix && due.key !== 'later' && (
        <span style={{ textDecoration: 'none' }}>
          · {due.key === 'done' ? 'complete' : due.key === 'soon' ? 'due soon' : 'overdue'}
        </span>
      )}
    </span>
  );
}
