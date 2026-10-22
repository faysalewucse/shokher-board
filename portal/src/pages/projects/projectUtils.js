import dayjs from 'dayjs';

export const PROJECT_STATUSES = [
  { value: 'planning', label: 'Planning' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
];
export const statusLabel = (s) => PROJECT_STATUSES.find((x) => x.value === s)?.label || s || 'Unknown';

/**
 * Project dates are calendar days. They're sent as `YYYY-MM-DD` (stored as
 * UTC midnight), so read back only the date part to avoid timezone drift.
 */
export const toDay = (d) => (d ? dayjs(String(d).slice(0, 10)) : null);
export const fromDay = (d) => (d ? d.format('YYYY-MM-DD') : null);

export const formatDay = (d) => {
  const day = toDay(d);
  if (!day) return '';
  return day.year() === dayjs().year() ? day.format('MMM D') : day.format('MMM D, YYYY');
};

/**
 * Deadline state for a project: `done` when the project is done, `overdue`
 * after the deadline day, `soon` within 7 days, otherwise `later`.
 */
export function deadlineStatus(deadline, status) {
  const day = toDay(deadline);
  if (!day) return null;
  if (status === 'done') return { key: 'done', label: 'Project done' };
  const today = dayjs().startOf('day');
  if (day.isBefore(today)) return { key: 'overdue', label: `Overdue by ${today.diff(day, 'day')}d` };
  const left = day.diff(today, 'day');
  if (left <= 7) return { key: 'soon', label: left === 0 ? 'Due today' : `Due in ${left}d` };
  return { key: 'later', label: 'Deadline' };
}

export const progressPercent = (progress) =>
  (progress?.total ? Math.round((progress.done / progress.total) * 100) : 0);

/** Format a full timestamp (createdAt / updatedAt) in local time. */
export const formatStamp = (d) => {
  if (!d) return '';
  const date = dayjs(d);
  return date.year() === dayjs().year() ? date.format('MMM D') : date.format('MMM D, YYYY');
};
