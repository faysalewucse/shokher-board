import {
  CheckOutlined, StopOutlined, ClockCircleOutlined, MinusOutlined, CloseOutlined,
  ArrowUpOutlined, ExclamationOutlined,
} from '@ant-design/icons';

/**
 * Monochrome chip. Meaning comes from the *style*, never from hue:
 *   solid   — black fill, white text (strongest / alarming)
 *   strong  — dark-gray fill, white text
 *   outline — 1px ink border
 *   dashed  — dashed border (pending / provisional)
 *   soft    — light-gray fill (neutral info)
 *   muted   — no border, gray text (de-emphasised)
 */
export default function MonoTag({ variant = 'outline', icon, children, className = '', title, strike, style }) {
  return (
    <span
      className={`mono-tag mono-tag--${variant} ${strike ? 'mono-tag--strike' : ''} ${className}`}
      title={title}
      style={style}
    >
      {icon && <span className="mono-tag__icon">{icon}</span>}
      {children}
    </span>
  );
}

const USER_STATUS = {
  active: { variant: 'outline', icon: <span className="mono-dot" /> },
  inactive: { variant: 'muted', icon: <MinusOutlined /> },
  suspended: { variant: 'solid', icon: <StopOutlined /> },
  pending: { variant: 'dashed', icon: <ClockCircleOutlined /> },
  deleted: { variant: 'muted', icon: <CloseOutlined />, strike: true },
};

/** Account status (users list, profile). */
export function StatusTag({ status }) {
  const s = USER_STATUS[status] || { variant: 'soft' };
  return (
    <MonoTag variant={s.variant} icon={s.icon} strike={s.strike}>
      {(status || 'unknown').toUpperCase()}
    </MonoTag>
  );
}

/** Boolean yes/no (e.g. email verified). */
export function YesNoTag({ value, yes = 'Yes', no = 'No' }) {
  return value
    ? <MonoTag variant="outline" icon={<CheckOutlined />}>{yes}</MonoTag>
    : <MonoTag variant="dashed">{no}</MonoTag>;
}

const PRIORITY = {
  urgent: { variant: 'solid', icon: <ExclamationOutlined />, label: 'Urgent' },
  high: { variant: 'strong', icon: <ArrowUpOutlined />, label: 'High' },
  medium: { variant: 'outline', label: 'Medium' },
  normal: { variant: 'outline', label: 'Normal' },
  low: { variant: 'muted', label: 'Low' },
};

/** Priority: urgent = solid black, high = dark gray, medium = outline, low = muted text. */
export function PriorityTag({ priority, label }) {
  const p = PRIORITY[priority] || PRIORITY.normal;
  return <MonoTag variant={p.variant} icon={p.icon}>{label || p.label}</MonoTag>;
}

/** Tabular count pill (permissions, unread, totals). */
export function CountPill({ value, muted }) {
  return <span className={`mono-count ${muted ? 'mono-count--muted' : ''}`}>{value}</span>;
}
