const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const { emitToBoard } = require('../lib/socket');
const activity = require('./activityService');
const { endPosition, rebalanceIfNeeded } = require('./positionService');
const { notifyCardUsers } = require('./boardNotify');
const { parseMessage } = require('./messageParser');
const {
  CARD_DETAIL_INCLUDE, MESSAGE_INCLUDE, toCardDetail, getCardSummary, toLabel, toMessage,
} = require('./boardFormat');

// ── helpers ─────────────────────────────────────────────────

const getActorName = async (userId) =>
  (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))?.name || null;

const assertListOnBoard = async (listId, boardId) => {
  const list = await prisma.list.findUnique({ where: { id: listId }, select: { id: true, boardId: true, archivedAt: true } });
  if (!list || list.boardId !== boardId) throwError('List not found on this board', 400);
  if (list.archivedAt) throwError('List is archived', 400);
  return list;
};

const assertMembers = async (boardId, userIds = []) => {
  const ids = [...new Set(userIds)];
  if (!ids.length) return ids;
  const members = await prisma.boardMember.findMany({
    where: { boardId, userId: { in: ids } },
    select: { userId: true },
  });
  if (members.length !== ids.length) throwError('All assignees must be members of the board', 400);
  return ids;
};

const assertLabels = async (boardId, labelIds = []) => {
  const ids = [...new Set(labelIds)];
  if (!ids.length) return ids;
  const count = await prisma.label.count({ where: { boardId, id: { in: ids } } });
  if (count !== ids.length) throwError('All labels must belong to the board', 400);
  return ids;
};

const emitCardsReordered = (boardId, items, actorId) => {
  if (items) emitToBoard(boardId, 'cards.reordered', { items }, actorId);
};

const loadCard = async (cardId) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throwError('Card not found', 404);
  return card;
};

// ── create (shared by board cards and messages) ─────────────

const insertCard = async (boardId, {
  listId, title, description, position, dueDate, startDate, priority, assigneeIds = [], labelIds = [], source = 'board',
}, ctx) => {
  await assertListOnBoard(listId, boardId);
  const assignees = await assertMembers(boardId, assigneeIds);
  const labels = await assertLabels(boardId, labelIds);

  const pos = position ?? (await endPosition('card', { listId, archivedAt: null }));
  const card = await prisma.card.create({
    data: {
      boardId,
      listId,
      title,
      description: description || null,
      position: pos,
      dueDate: dueDate || null,
      startDate: startDate || null,
      priority: priority || null,
      source,
      createdById: ctx.userId,
      assignees: { create: assignees.map((userId) => ({ userId })) },
      labels: { create: labels.map((labelId) => ({ labelId })) },
    },
  });

  const items = position !== undefined ? await rebalanceIfNeeded('card', card) : null;

  await activity.log({
    type: 'card.created', boardId, cardId: card.id, projectId: ctx.projectId, actorId: ctx.userId,
    data: { listId, title, source },
  });
  if (assignees.length) {
    await activity.logMany(assignees.map((userId) => ({
      type: 'card.assigned', boardId, cardId: card.id, projectId: ctx.projectId, actorId: ctx.userId, data: { userId },
    })));
    await notifyCardUsers('card.assigned', assignees, card, { actorId: ctx.userId, actorName: await getActorName(ctx.userId) });
  }
  return { card, items };
};

const createCard = async (boardId, body, ctx) => {
  const { card, items } = await insertCard(boardId, { ...body, source: 'board' }, ctx);
  const summary = await getCardSummary(card.id);
  emitToBoard(boardId, 'card.created', summary, ctx.userId);
  emitCardsReordered(boardId, items, ctx.userId);
  return summary;
};

// ── read ────────────────────────────────────────────────────

const getCard = async (cardId) => {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: CARD_DETAIL_INCLUDE });
  if (!card) throwError('Card not found', 404);
  return toCardDetail(card);
};

const listCardActivity = (cardId, { cursor, limit }) => activity.list({ cardId }, { cursor, limit });

// ── update ──────────────────────────────────────────────────

const UPDATABLE = ['title', 'description', 'dueDate', 'startDate', 'priority'];

const sameValue = (a, b) => {
  if (a instanceof Date || b instanceof Date) {
    return (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
  }
  return (a ?? null) === (b ?? null);
};

const updateCard = async (cardId, body, ctx) => {
  const card = await loadCard(cardId);
  const data = {};
  const fields = [];

  for (const key of UPDATABLE) {
    if (body[key] === undefined) continue;
    const value = body[key] === '' ? null : body[key];
    if (!sameValue(card[key], value)) {
      data[key] = value;
      fields.push(key);
    }
  }
  // A changed due date can trigger a fresh due-soon notification.
  if (fields.includes('dueDate')) data.dueNotifiedAt = null;

  let completionType = null;
  if (body.completed === true && !card.completedAt) {
    data.completedAt = new Date();
    completionType = 'card.completed';
  } else if (body.completed === false && card.completedAt) {
    data.completedAt = null;
    completionType = 'card.reopened';
  }

  if (Object.keys(data).length) {
    await prisma.card.update({ where: { id: cardId }, data });
    const base = { boardId: card.boardId, cardId, projectId: ctx.projectId, actorId: ctx.userId };
    if (fields.length) await activity.log({ ...base, type: 'card.updated', data: { fields } });
    if (completionType) await activity.log({ ...base, type: completionType });
  }

  const summary = await getCardSummary(cardId);
  if (Object.keys(data).length) emitToBoard(card.boardId, 'card.updated', summary, ctx.userId);
  return summary;
};

const moveCard = async (cardId, { listId, position }, ctx) => {
  const card = await loadCard(cardId);
  if (card.archivedAt) throwError('Card is archived', 400);
  await assertListOnBoard(listId, card.boardId);

  const moved = await prisma.card.update({ where: { id: cardId }, data: { listId, position } });
  const items = await rebalanceIfNeeded('card', moved);

  if (card.listId !== listId) {
    await activity.log({
      type: 'card.moved', boardId: card.boardId, cardId, projectId: ctx.projectId, actorId: ctx.userId,
      data: { fromListId: card.listId, toListId: listId },
    });
  }

  const summary = await getCardSummary(cardId);
  emitToBoard(card.boardId, 'card.moved', summary, ctx.userId);
  emitCardsReordered(card.boardId, items, ctx.userId);
  return summary;
};

const archiveCard = async (cardId, ctx) => {
  const card = await loadCard(cardId);
  if (!card.archivedAt) {
    await prisma.card.update({ where: { id: cardId }, data: { archivedAt: new Date() } });
    await activity.log({
      type: 'card.archived', boardId: card.boardId, cardId, projectId: ctx.projectId, actorId: ctx.userId,
      data: { title: card.title },
    });
  }
  emitToBoard(card.boardId, 'card.deleted', { id: cardId }, ctx.userId);
};

const setAssignees = async (cardId, { userIds }, ctx) => {
  const card = await loadCard(cardId);
  const ids = await assertMembers(card.boardId, userIds);

  const current = (await prisma.cardAssignee.findMany({ where: { cardId }, select: { userId: true } })).map((a) => a.userId);
  const added = ids.filter((id) => !current.includes(id));
  const removed = current.filter((id) => !ids.includes(id));

  if (added.length || removed.length) {
    await prisma.$transaction([
      prisma.cardAssignee.deleteMany({ where: { cardId, userId: { in: removed } } }),
      prisma.cardAssignee.createMany({ data: added.map((userId) => ({ cardId, userId })), skipDuplicates: true }),
    ]);
    const base = { boardId: card.boardId, cardId, projectId: ctx.projectId, actorId: ctx.userId };
    await activity.logMany([
      ...added.map((userId) => ({ ...base, type: 'card.assigned', data: { userId } })),
      ...removed.map((userId) => ({ ...base, type: 'card.unassigned', data: { userId } })),
    ]);
    if (added.length) {
      await notifyCardUsers('card.assigned', added, card, { actorId: ctx.userId, actorName: await getActorName(ctx.userId) });
    }
  }

  const summary = await getCardSummary(cardId);
  if (added.length || removed.length) emitToBoard(card.boardId, 'card.updated', summary, ctx.userId);
  return summary;
};

const setLabels = async (cardId, { labelIds }, ctx) => {
  const card = await loadCard(cardId);
  const ids = await assertLabels(card.boardId, labelIds);

  await prisma.$transaction([
    prisma.cardLabel.deleteMany({ where: { cardId, labelId: { notIn: ids } } }),
    prisma.cardLabel.createMany({ data: ids.map((labelId) => ({ cardId, labelId })), skipDuplicates: true }),
  ]);

  const summary = await getCardSummary(cardId);
  emitToBoard(card.boardId, 'card.updated', summary, ctx.userId);
  return summary;
};

// ── messages (message-to-card bar) ──────────────────────────

const listMessages = async (boardId, { before, limit } = {}) => {
  const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const where = { boardId, source: 'message' };

  if (before) {
    let beforeDate = null;
    const asDate = new Date(String(before));
    if (!Number.isNaN(asDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(String(before))) {
      beforeDate = asDate;
    } else {
      const ref = await prisma.card.findUnique({ where: { id: String(before) }, select: { createdAt: true } });
      if (ref) beforeDate = ref.createdAt;
    }
    if (beforeDate) where.createdAt = { lt: beforeDate };
  }

  const rows = await prisma.card.findMany({
    where,
    include: MESSAGE_INCLUDE,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
  });
  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, take) : rows).map(toMessage);
  return { items, nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null };
};

const createMessage = async (boardId, { text, listId }, ctx) => {
  let targetListId = listId;
  if (!targetListId) {
    const inbox = await prisma.list.findFirst({
      where: { boardId, isInbox: true, archivedAt: null },
      select: { id: true },
    });
    const fallback = inbox || (await prisma.list.findFirst({
      where: { boardId, archivedAt: null }, orderBy: { position: 'asc' }, select: { id: true },
    }));
    if (!fallback) throwError('This board has no list to put the message in', 400);
    targetListId = fallback.id;
  }

  const [memberships, labels] = await Promise.all([
    prisma.boardMember.findMany({ where: { boardId }, include: { user: { select: { id: true, name: true, email: true } } } }),
    prisma.label.findMany({ where: { boardId }, select: { id: true, name: true } }),
  ]);

  const parsed = parseMessage(text, { members: memberships.map((m) => m.user), labels });

  // `#token` labels that don't exist yet are created (color blue).
  const createdLabels = [];
  for (const name of parsed.newLabelNames) {
    const label = await prisma.label.create({ data: { boardId, name: name.slice(0, 100), color: 'blue' } });
    createdLabels.push(label);
    parsed.labelIds.push(label.id);
  }
  createdLabels.forEach((l) => emitToBoard(boardId, 'label.created', toLabel(l), ctx.userId));

  const { card } = await insertCard(boardId, {
    listId: targetListId,
    title: parsed.title.slice(0, 500),
    description: parsed.description,
    dueDate: parsed.dueDate,
    assigneeIds: parsed.assigneeIds,
    labelIds: parsed.labelIds,
    source: 'message',
  }, ctx);

  const full = await prisma.card.findUnique({ where: { id: card.id }, include: MESSAGE_INCLUDE });
  const message = toMessage(full);
  emitToBoard(boardId, 'message.created', message, ctx.userId);
  return message;
};

module.exports = {
  createCard,
  getCard,
  updateCard,
  moveCard,
  archiveCard,
  setAssignees,
  setLabels,
  listCardActivity,
  listMessages,
  createMessage,
};
