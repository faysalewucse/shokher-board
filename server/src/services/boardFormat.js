/**
 * Prisma selects + mappers that produce the response shapes defined in
 * docs/boards-contract.md (UserLite, Board, List, CardSummary, CardDetail, ...).
 */
const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');

const USER_LITE = { id: true, name: true, email: true, avatar: true };
const USER_LITE_SELECT = { select: USER_LITE };

const toUserLite = (u) => (u ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar ?? null } : null);

// ── Card ────────────────────────────────────────────────────
const CARD_SUMMARY_INCLUDE = {
  assignees: { include: { user: USER_LITE_SELECT }, orderBy: { createdAt: 'asc' } },
  labels: { select: { labelId: true }, orderBy: { createdAt: 'asc' } },
  checklists: { select: { items: { select: { isDone: true } } } },
  _count: { select: { comments: true, attachments: true } },
};

const toCardSummary = (card) => {
  const items = (card.checklists || []).flatMap((c) => c.items || []);
  return {
    id: card.id,
    boardId: card.boardId,
    listId: card.listId,
    title: card.title,
    position: card.position,
    dueDate: card.dueDate,
    startDate: card.startDate,
    priority: card.priority,
    completedAt: card.completedAt,
    source: card.source,
    createdById: card.createdById,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    assignees: (card.assignees || []).map((a) => toUserLite(a.user)),
    labelIds: (card.labels || []).map((l) => l.labelId),
    counts: {
      comments: card._count?.comments ?? 0,
      attachments: card._count?.attachments ?? 0,
      checklistItems: items.length,
      checklistDone: items.filter((i) => i.isDone).length,
    },
    hasDescription: !!(card.description && card.description.trim()),
  };
};

const CARD_DETAIL_INCLUDE = {
  ...CARD_SUMMARY_INCLUDE,
  createdBy: USER_LITE_SELECT,
  checklists: {
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: { items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
  },
  attachments: { orderBy: { createdAt: 'desc' }, include: { uploader: USER_LITE_SELECT } },
};

const toChecklistItem = (i) => ({
  id: i.id, text: i.text, isDone: i.isDone, position: i.position, assigneeId: i.assigneeId, dueDate: i.dueDate,
});

const toChecklist = (c) => ({
  id: c.id, title: c.title, position: c.position, items: (c.items || []).map(toChecklistItem),
});

const toAttachment = (a) => ({
  id: a.id, fileName: a.fileName, url: a.url, mimeType: a.mimeType, size: a.size,
  uploader: toUserLite(a.uploader), createdAt: a.createdAt,
});

const toCardDetail = (card) => ({
  ...toCardSummary(card),
  description: card.description,
  createdBy: toUserLite(card.createdBy),
  archivedAt: card.archivedAt,
  checklists: (card.checklists || []).map(toChecklist),
  attachments: (card.attachments || []).map(toAttachment),
});

const getCardSummary = async (cardId) => {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: CARD_SUMMARY_INCLUDE });
  if (!card) throwError('Card not found', 404);
  return toCardSummary(card);
};

// ── Board & children ────────────────────────────────────────
const BOARD_INCLUDE = {
  project: { select: { id: true, name: true, client: { select: { id: true, name: true } } } },
};

const toBoard = (b, myRole = null) => ({
  id: b.id,
  name: b.name,
  description: b.description,
  color: b.color,
  projectId: b.projectId,
  project: b.project
    ? { id: b.project.id, name: b.project.name, client: b.project.client ? { id: b.project.client.id, name: b.project.client.name } : null }
    : null,
  archivedAt: b.archivedAt,
  createdAt: b.createdAt,
  updatedAt: b.updatedAt,
  myRole,
});

const toMember = (m) => ({ userId: m.userId, role: m.role, user: toUserLite(m.user) });
const toLabel = (l) => ({ id: l.id, boardId: l.boardId, name: l.name, color: l.color });
const toList = (l) => ({ id: l.id, boardId: l.boardId, name: l.name, position: l.position, isInbox: l.isInbox, archivedAt: l.archivedAt });

const toComment = (c) => ({
  id: c.id, cardId: c.cardId, body: c.body, author: toUserLite(c.author), createdAt: c.createdAt, editedAt: c.editedAt,
});

const toActivity = (a) => ({
  id: a.id, boardId: a.boardId, cardId: a.cardId, projectId: a.projectId, type: a.type, data: a.data,
  actor: toUserLite(a.actor), createdAt: a.createdAt,
});

/** Message = a card created from the message bar (source='message'). */
const MESSAGE_INCLUDE = { ...CARD_SUMMARY_INCLUDE, createdBy: USER_LITE_SELECT };
const toMessage = (card) => ({
  id: card.id,
  text: card.title,
  description: card.description,
  listId: card.listId,
  author: toUserLite(card.createdBy),
  createdAt: card.createdAt,
  card: toCardSummary(card),
});

module.exports = {
  USER_LITE,
  USER_LITE_SELECT,
  toUserLite,
  CARD_SUMMARY_INCLUDE,
  CARD_DETAIL_INCLUDE,
  toCardSummary,
  toCardDetail,
  getCardSummary,
  toChecklist,
  toChecklistItem,
  toAttachment,
  BOARD_INCLUDE,
  toBoard,
  toMember,
  toLabel,
  toList,
  toComment,
  toActivity,
  MESSAGE_INCLUDE,
  toMessage,
};
