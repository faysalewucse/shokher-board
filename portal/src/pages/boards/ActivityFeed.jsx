import { Avatar, Tooltip } from 'antd';
import MonoEmpty from '@/components/MonoEmpty';
import { avatarSrc, initials, fromNow, describeActivity } from './boardUtils';

/** Plain list of Activity rows (shared by the board drawer and card tab). */
export default function ActivityFeed({ items, context, emptyText = 'No activity yet' }) {
  if (!items?.length) return <MonoEmpty compact description={emptyText} />;
  return (
    <div className="relative flex flex-col gap-3.5 before:absolute before:bottom-2 before:left-[13.5px] before:top-2 before:w-px before:bg-line">
      {items.map((a) => (
        <div key={a.id} className="relative flex gap-2.5">
          <Avatar size={28} src={avatarSrc(a.actor)} style={{ background: 'var(--c-avatar-bg)', color: 'var(--c-avatar-fg)', flexShrink: 0, fontSize: 11, boxShadow: '0 0 0 3px var(--c-surface)' }}>
            {initials(a.actor?.name)}
          </Avatar>
          <div className="min-w-0 text-[12.5px] leading-5 text-fg-2">
            <span className="font-bold text-fg">{a.actor?.name || 'Someone'}</span>{' '}
            {describeActivity(a, context)}
            <div>
              <Tooltip title={new Date(a.createdAt).toLocaleString()}>
                <span className="mono text-[10.5px] text-fg-3">{fromNow(a.createdAt)}</span>
              </Tooltip>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
