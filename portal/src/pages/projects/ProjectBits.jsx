import { Avatar, Progress, Tooltip } from 'antd';
import {
  CheckOutlined, ClockCircleOutlined, ExclamationCircleFilled, CalendarOutlined, PauseOutlined,
} from '@ant-design/icons';
import MonoTag from '@/components/MonoTag';
import { avatarSrc, initials } from '@/pages/boards/boardUtils';
import { deadlineStatus, formatDay, progressPercent, statusLabel } from './projectUtils';

const STATUS_LOOK = {
  planning: { variant: 'dashed', icon: <ClockCircleOutlined /> },
  active: { variant: 'solid', icon: <span className="mono-dot" style={{ background: 'currentColor' }} /> },
  on_hold: { variant: 'outline', icon: <PauseOutlined /> },
  done: { variant: 'soft', icon: <CheckOutlined /> },
};

/** Monochrome project status: planning = dashed, active = solid, on hold = outline, done = soft + check. */
export function ProjectStatusTag({ status, className }) {
  const look = STATUS_LOOK[status] || { variant: 'soft' };
  return (
    <MonoTag variant={look.variant} icon={look.icon} className={className}>
      {statusLabel(status)}
    </MonoTag>
  );
}

const DEADLINE_LOOK = {
  done: { cls: 'meta-badge--done', icon: <CheckOutlined /> },
  soon: { cls: 'meta-badge--outline meta-badge--bold', icon: <ClockCircleOutlined /> },
  overdue: { cls: 'meta-badge--solid', icon: <ExclamationCircleFilled /> },
  later: { cls: '', icon: <CalendarOutlined /> },
};

/** Deadline badge in the board due-badge style (overdue = solid black + alert icon). */
export function DeadlineBadge({ deadline, status, empty = null }) {
  const due = deadlineStatus(deadline, status);
  if (!due) return empty;
  const look = DEADLINE_LOOK[due.key];
  return (
    <Tooltip title={due.label}>
      <span className={`meta-badge ${look.cls}`} aria-label={`${due.label}: ${formatDay(deadline)}`}>
        {look.icon}
        <span className="meta-badge__text">{formatDay(deadline)}</span>
      </span>
    </Tooltip>
  );
}

/** Card completion bar (done / total cards across the project's boards). */
export function ProjectProgress({ progress, compact = false }) {
  const total = progress?.total || 0;
  const done = progress?.done || 0;
  const pct = progressPercent(progress);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="mono tnum text-[10.5px] uppercase tracking-[0.08em] text-fg-3">
          {total ? `${done}/${total} cards` : 'No cards yet'}
        </span>
        <span className={`mono tnum font-semibold text-fg ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{pct}%</span>
      </div>
      <Progress
        percent={pct}
        showInfo={false}
        size={{ height: compact ? 4 : 6 }}
        strokeLinecap="butt"
        strokeColor="var(--c-fg)"
        railColor="var(--c-surface-3)"
        style={{ margin: 0, lineHeight: 0 }}
      />
    </div>
  );
}

/** Square monochrome avatar with the owner's initials. */
export function OwnerAvatar({ user, size = 24, withName = false }) {
  if (!user) return withName ? <span className="text-[12.5px] text-fg-3">—</span> : null;
  const avatar = (
    <Avatar
      size={size}
      src={avatarSrc(user)}
      shape="square"
      style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', fontSize: Math.round(size * 0.42), fontWeight: 700, borderRadius: 4, flexShrink: 0 }}
    >
      {initials(user.name)}
    </Avatar>
  );
  if (!withName) return <Tooltip title={`Owner · ${user.name}`}>{avatar}</Tooltip>;
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {avatar}
      <span className="truncate text-[13px] font-semibold text-fg">{user.name}</span>
    </span>
  );
}
