const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const { emitToBoard, removeUserFromBoardRoom } = require('../lib/socket');
const activity = require('./activityService');
const { canManageAny } = require('./boardAccess');
const { GAP, endPosition, rebalanceIfNeeded } = require('./positionService');
const {
  USER_LITE_SELECT, BOARD_INCLUDE, CARD_SUMMARY_INCLUDE,
  toBoard, toMember, toLabel, toList, toCardSummary,
} = require('./boardFormat');

const MEMBER_INCLUDE = { user: USER_LITE_SELECT };

// Board payload for socket events: myRole is per-viewer, so it is omitted.
const boardEventPayload = (b) => {
  const { myRole, ...rest } = toBoard(b);
  return rest;
};

// ── Boards ──────────────────────────────────────────────────

const listBoards = async ({ projectId, standalone, archived } = {}, { userId, permissions }) => {
  const manageAny = canManageAny(permissions);
  const where = { archivedAt: archived === 'true' ? { not: null } : null };
  if (!manageAny) where.members = { some: { userId } };
  if (projectId) where.projectId = String(projectId);
  else if (standalone === 'true' || standalone === true) where.projectId = null;

  const boards = await prisma.board.findMany({
    where,
    include: { ...BOARD_INCLUDE, members: { where: { userId }, select: { role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return boards.map((b) => toBoard(b, manageAny ? 'owner' : b.members[0]?.role || null));
};

const createBoard = async ({ name, description, color, projectId }, { userId }) => {
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throwError('Project not found', 400);
  }

  const board = await prisma.$transaction(async (tx) => {
    const created = await tx.board.create({
      data: { name, description, color, projectId: projectId || null, createdById: userId },
    });
    await tx.boardMember.create({ data: { boardId: created.id, userId, role: 'owner' } });
    await tx.list.create({ data: { boardId: created.id, name: 'Inbox', position: GAP, isInbox: true } });
    return tx.board.findUnique({ where: { id: created.id }, include: BOARD_INCLUDE });
  });

  await activity.log({
    type: 'board.created', boardId: board.id, projectId: board.projectId, actorId: userId, data: { name: board.name },
  });
  return toBoard(board, 'owner');
};

const getBoard = async (boardId, { role }) => {
  const [board, members, labels, lists, cards] = await Promise.all([
    prisma.board.findUnique({ where: { id: boardId }, include: BOARD_INCLUDE }),
    prisma.boardMember.findMany({ where: { boardId }, include: MEMBER_INCLUDE, orderBy: { createdAt: 'asc' } }),
    prisma.label.findMany({ where: { boardId }, orderBy: { createdAt: 'asc' } }),
    prisma.list.findMany({ where: { boardId, archivedAt: null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] }),
    prisma.card.findMany({
      where: { boardId, archivedAt: null, list: { archivedAt: null } },
      include: CARD_SUMMARY_INCLUDE,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);
  if (!board) throwError('Board not found', 404);

  return {
    board: toBoard(board, role),
    members: members.map(toMember),
    labels: labels.map(toLabel),
    lists: lists.map(toList),
    cards: cards.map(toCardSummary),
  };
};

const updateBoard = async (boardId, data, { userId, role }) => {
  if (data.projectId) {
    const project = await prisma.project.findUnique({ where: { id: data.projectId }, select: { id: true } });
    if (!project) throwError('Project not found', 400);
  }
  const board = await prisma.board.update({ where: { id: boardId }, data, include: BOARD_INCLUDE });
  emitToBoard(boardId, 'board.updated', boardEventPayload(board), userId);
  return toBoard(board, role);
};

const archiveBoard = async (boardId, { userId }) => {
  const existing = await prisma.board.findUnique({ where: { id: boardId }, select: { archivedAt: true } });
  await prisma.board.update({ where: { id: boardId }, data: { archivedAt: existing?.archivedAt || new Date() } });
  emitToBoard(boardId, 'board.deleted', { id: boardId }, userId);
};

// ── Members ─────────────────────────────────────────────────

const countOwners = (boardId) => prisma.boardMember.count({ where: { boardId, role: 'owner' } });

const addMember = async (boardId, { userId: memberId, role }, ctx) => {
  const user = await prisma.user.findUnique({ where: { id: memberId }, select: { id: true } });
  if (!user) throwError('User not found', 404);

  const existing = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: memberId } } });
  if (existing) throwError('User is already a member of this board', 409);

  const member = await prisma.boardMember.create({
    data: { boardId, userId: memberId, role },
    include: MEMBER_INCLUDE,
  });
  await activity.log({
    type: 'member.added', boardId, projectId: ctx.projectId, actorId: ctx.userId, data: { userId: memberId, role },
  });
  const payload = toMember(member);
  emitToBoard(boardId, 'member.added', payload, ctx.userId);
  return payload;
};

const updateMember = async (boardId, memberId, { role }, ctx) => {
  const existing = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: memberId } } });
  if (!existing) throwError('Member not found', 404);
  if (existing.role === 'owner' && role !== 'owner' && (await countOwners(boardId)) <= 1) {
    throwError('A board needs at least one owner', 400);
  }

  const member = await prisma.boardMember.update({
    where: { id: existing.id },
    data: { role },
    include: MEMBER_INCLUDE,
  });
  const payload = toMember(member);
  emitToBoard(boardId, 'member.updated', payload, ctx.userId);
  return payload;
};

const removeMember = async (boardId, memberId, ctx) => {
  const existing = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId: memberId } } });
  if (!existing) throwError('Member not found', 404);
  if (existing.role === 'owner' && (await countOwners(boardId)) <= 1) {
    throwError('The last owner of a board cannot be removed', 400);
  }

  await prisma.boardMember.delete({ where: { id: existing.id } });
  await activity.log({
    type: 'member.removed', boardId, projectId: ctx.projectId, actorId: ctx.userId, data: { userId: memberId },
  });
  emitToBoard(boardId, 'member.removed', { id: memberId, userId: memberId }, ctx.userId);
  removeUserFromBoardRoom(memberId, boardId);
};

// ── Labels ──────────────────────────────────────────────────

const createLabel = async (boardId, { name, color }, ctx) => {
  const label = await prisma.label.create({ data: { boardId, name, color: color || 'blue' } });
  const payload = toLabel(label);
  emitToBoard(boardId, 'label.created', payload, ctx.userId);
  return payload;
};

const updateLabel = async (labelId, data, ctx) => {
  const label = await prisma.label.update({ where: { id: labelId }, data });
  const payload = toLabel(label);
  emitToBoard(label.boardId, 'label.updated', payload, ctx.userId);
  return payload;
};

const deleteLabel = async (labelId, ctx) => {
  const label = await prisma.label.delete({ where: { id: labelId } });
  emitToBoard(label.boardId, 'label.deleted', { id: labelId }, ctx.userId);
};

// ── Lists ───────────────────────────────────────────────────

const emitListsReordered = (boardId, items, actorId) => {
  if (items) emitToBoard(boardId, 'lists.reordered', { items }, actorId);
};

const createList = async (boardId, { name, position }, ctx) => {
  const pos = position ?? (await endPosition('list', { boardId, archivedAt: null }));
  let list = await prisma.list.create({ data: { boardId, name, position: pos } });

  const items = position !== undefined ? await rebalanceIfNeeded('list', list) : null;
  if (items) list = await prisma.list.findUnique({ where: { id: list.id } });

  await activity.log({
    type: 'list.created', boardId, projectId: ctx.projectId, actorId: ctx.userId, data: { listId: list.id, name },
  });
  const payload = toList(list);
  emitToBoard(boardId, 'list.created', payload, ctx.userId);
  emitListsReordered(boardId, items, ctx.userId);
  return payload;
};

const updateList = async (listId, data, ctx) => {
  let list = await prisma.list.update({ where: { id: listId }, data });
  const items = data.position !== undefined ? await rebalanceIfNeeded('list', list) : null;
  if (items) list = await prisma.list.findUnique({ where: { id: listId } });

  const payload = toList(list);
  emitToBoard(list.boardId, 'list.updated', payload, ctx.userId);
  emitListsReordered(list.boardId, items, ctx.userId);
  return payload;
};

const archiveList = async (listId, ctx) => {
  const list = await prisma.list.findUnique({ where: { id: listId } });
  if (!list) throwError('List not found', 404);
  if (list.isInbox) throwError('The Inbox list cannot be deleted', 400);

  const now = new Date();
  await prisma.$transaction([
    prisma.list.update({ where: { id: listId }, data: { archivedAt: list.archivedAt || now } }),
    prisma.card.updateMany({ where: { listId, archivedAt: null }, data: { archivedAt: now } }),
  ]);
  await activity.log({
    type: 'list.archived', boardId: list.boardId, projectId: ctx.projectId, actorId: ctx.userId,
    data: { listId, name: list.name },
  });
  emitToBoard(list.boardId, 'list.deleted', { id: listId }, ctx.userId);
};

// ── Activity ────────────────────────────────────────────────

const listBoardActivity = (boardId, { cursor, limit }) => activity.list({ boardId }, { cursor, limit });

module.exports = {
  listBoards,
  createBoard,
  getBoard,
  updateBoard,
  archiveBoard,
  addMember,
  updateMember,
  removeMember,
  createLabel,
  updateLabel,
  deleteLabel,
  createList,
  updateList,
  archiveList,
  listBoardActivity,
};
