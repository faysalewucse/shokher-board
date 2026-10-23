import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getFileUrl } from '@/services/api';

dayjs.extend(relativeTime);

/**
 * Labels keep their stored colour name (the API default is `blue`); the UI
 * renders each name as a distinct *monochrome style* instead of a hue.
 * Order here = order in the labels-modal picker.
 */
export const LABEL_STYLES = {
  black: { style: 'solid', name: 'Solid' },
  pink: { style: 'graphite', name: 'Graphite' },
  purple: { style: 'tint', name: 'Tint' },
  blue: { style: 'outline', name: 'Outline' },
  green: { style: 'dashed', name: 'Dashed' },
  sky: { style: 'dotted', name: 'Dotted' },
  orange: { style: 'double', name: 'Double' },
  red: { style: 'hatched', name: 'Hatched' },
  yellow: { style: 'dot', name: 'Dot' },
  lime: { style: 'ring', name: 'Ring' },
};
export const LABEL_COLOR_OPTIONS = Object.keys(LABEL_STYLES);

const hashIndex = (str, n) => {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % n;
};

/** Monochrome style for a stored label colour (unknown/hex values hash to a style). */
export const labelStyle = (color) => {
  const key = String(color || 'blue').toLowerCase();
  if (LABEL_STYLES[key]) return LABEL_STYLES[key];
  return LABEL_STYLES[LABEL_COLOR_OPTIONS[hashIndex(key, LABEL_COLOR_OPTIONS.length)]];
};

/**
 * Board "colour" values as stored by the API (unchanged). Each maps to a
 * grayscale tone + pattern (see `.board-surface--N` in index.css).
 */
export const BOARD_COLORS = [
  '#303467', '#0c66e4', '#1f845a', '#c25100', '#ae2e24',
  '#6e5dc6', '#227d9b', '#943d73', '#596773', '#5b7f24',
];
export const DEFAULT_BOARD_COLOR = '#0c66e4';

export const BOARD_SURFACE_NAMES = [
  'Ink', 'Ink · Dots', 'Graphite · Stripes', 'Graphite · Grid', 'Charcoal',
  'Charcoal · Dots', 'Slate · Stripes', 'Ink · Grid', 'Slate', 'Ink · Crosshatch',
];

/** Index (0–9) of the monochrome surface for a stored board colour. */
export const boardSurfaceIndex = (color) => {
  const c = String(color || DEFAULT_BOARD_COLOR).toLowerCase();
  const i = BOARD_COLORS.indexOf(c);
  return i >= 0 ? i : hashIndex(c, BOARD_COLORS.length);
};
export const boardSurfaceClass = (color) => `board-surface board-surface--${boardSurfaceIndex(color)}`;
export const boardSurfaceName = (color) => BOARD_SURFACE_NAMES[boardSurfaceIndex(color)];

export const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
export const priorityMeta = (p) => PRIORITIES.find((x) => x.value === p);

/**
 * Due state: `done` when completed, `overdue` when past, `soon` when due
 * within 24h, otherwise `later`. Rendered by <DueBadge> (fill/outline/icon).
 */
export function dueStatus(dueDate, completedAt) {
  if (!dueDate) return null;
  const due = dayjs(dueDate);
  if (completedAt) return { key: 'done', label: 'Completed' };
  const now = dayjs();
  if (due.isBefore(now)) return { key: 'overdue', label: 'Overdue' };
  if (due.diff(now, 'hour', true) < 24) return { key: 'soon', label: 'Due within 24 hours' };
  return { key: 'later', label: 'Due date' };
}

export const formatDue = (d) => {
  if (!d) return '';
  const date = dayjs(d);
  return date.year() === dayjs().year() ? date.format('MMM D') : date.format('MMM D, YYYY');
};

export const fromNow = (d) => (d ? dayjs(d).fromNow() : '');

export const avatarSrc = (user) => (user?.avatar ? getFileUrl(user.avatar) : undefined);
export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

/** Mention token for a user as the server matches it: name without spaces. */
export const mentionToken = (user) =>
  (user?.name || user?.email?.split('@')[0] || '').replace(/\s+/g, '');
export const labelToken = (label) => (label?.name || '').replace(/\s+/g, '');

export const isMessageCard = (card) => card?.source === 'message';

/** Build the CardSummary-shaped fields from a CardDetail (+ optional comment count). */
export function summaryFromDetail(detail, commentCount) {
  const items = (detail.checklists || []).flatMap((c) => c.items || []);
  return {
    id: detail.id,
    boardId: detail.boardId,
    listId: detail.listId,
    title: detail.title,
    position: detail.position,
    dueDate: detail.dueDate,
    startDate: detail.startDate,
    priority: detail.priority,
    completedAt: detail.completedAt,
    source: detail.source,
    assignees: detail.assignees || [],
    labelIds: detail.labelIds || [],
    hasDescription: !!(detail.description && detail.description.trim()),
    counts: {
      ...(detail.counts || {}),
      comments: commentCount ?? detail.counts?.comments ?? 0,
      attachments: (detail.attachments || []).length,
      checklistItems: items.length,
      checklistDone: items.filter((i) => i.isDone).length,
    },
  };
}

/** Sentence describing an Activity row. */
export function describeActivity(a, { lists = [], cardsById = {}, members = [] } = {}) {
  const d = a.data || {};
  const listName = (id) => lists.find((l) => l.id === id)?.name || 'another list';
  const userName = (id) => members.find((m) => m.userId === id)?.user?.name || 'someone';
  const card = d.title || d.cardTitle || cardsById[a.cardId]?.title;
  const cardRef = card ? `"${card}"` : 'a card';
  switch (a.type) {
    case 'card.created': return `added ${cardRef}${d.listId ? ` to ${listName(d.listId)}` : ''}`;
    case 'card.moved': return `moved ${cardRef} from ${listName(d.fromListId)} to ${listName(d.toListId)}`;
    case 'card.updated': {
      const fields = Array.isArray(d.fields) ? d.fields.join(', ') : null;
      return `updated ${fields ? `${fields} on ` : ''}${cardRef}`;
    }
    case 'card.completed': return `completed ${cardRef}`;
    case 'card.reopened': return `reopened ${cardRef}`;
    case 'card.assigned': return `assigned ${userName(d.userId)} to ${cardRef}`;
    case 'card.unassigned': return `removed ${userName(d.userId)} from ${cardRef}`;
    case 'card.archived': return `archived ${cardRef}`;
    case 'comment.created': return `commented on ${cardRef}`;
    case 'attachment.added': return `attached ${d.fileName ? `"${d.fileName}"` : 'a file'} to ${cardRef}`;
    case 'checklist.item_done': return `completed ${d.text ? `"${d.text}"` : 'an item'} on ${cardRef}`;
    case 'list.created': return `added list ${d.name ? `"${d.name}"` : ''}`.trim();
    case 'list.archived': return `archived list ${d.name ? `"${d.name}"` : ''}`.trim();
    case 'board.created': return 'created this board';
    case 'board.imported': return `imported this board from ${d.source === 'trello' ? 'Trello' : d.source || 'another tool'}${d.counts ? ` (${d.counts.lists} lists, ${d.counts.cards} cards)` : ''}`;
    case 'member.added': return `added ${userName(d.userId)} to the board`;
    case 'member.removed': return `removed ${d.userName || userName(d.userId)} from the board`;
    case 'project.created': return 'created the project';
    case 'project.status_changed': return `changed project status${d.status ? ` to ${d.status}` : ''}`;
    case 'client.created': return 'created the client';
    default: return a.type;
  }
}
