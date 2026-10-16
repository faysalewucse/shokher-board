const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');

/**
 * Board access control. Access goes through BoardMember (owner | member | viewer).
 * Users with BOARD_MANAGE_ANY are treated as owners of every board.
 */
const ROLE_RANK = { viewer: 1, member: 2, owner: 3 };
const BOARD_ROLES = Object.keys(ROLE_RANK);

const canManageAny = (permissions = []) => (permissions || []).includes('BOARD_MANAGE_ANY');

/**
 * Effective role of a user on a board, or null when they have no access.
 * @param {string} userId
 * @param {string} boardId
 * @param {string[]} [permissions] - decoded JWT permissions (req.permissions)
 */
const getBoardRole = async (userId, boardId, permissions = []) => {
  if (!userId || !boardId) return null;
  if (canManageAny(permissions)) {
    const board = await prisma.board.findUnique({ where: { id: boardId }, select: { id: true } });
    return board ? 'owner' : null;
  }
  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  });
  return membership?.role || null;
};

const hasRole = (role, min) => !!role && (ROLE_RANK[role] || 0) >= (ROLE_RANK[min] || 0);

// child entity → boardId resolvers
const RESOLVERS = {
  board: async (id) => id,
  list: async (id) => (await prisma.list.findUnique({ where: { id }, select: { boardId: true } }))?.boardId,
  card: async (id) => (await prisma.card.findUnique({ where: { id }, select: { boardId: true } }))?.boardId,
  label: async (id) => (await prisma.label.findUnique({ where: { id }, select: { boardId: true } }))?.boardId,
  checklist: async (id) =>
    (await prisma.checklist.findUnique({ where: { id }, select: { card: { select: { boardId: true } } } }))?.card?.boardId,
  checklistItem: async (id) =>
    (await prisma.checklistItem.findUnique({
      where: { id },
      select: { checklist: { select: { card: { select: { boardId: true } } } } },
    }))?.checklist?.card?.boardId,
  comment: async (id) =>
    (await prisma.comment.findUnique({ where: { id }, select: { card: { select: { boardId: true } } } }))?.card?.boardId,
  attachment: async (id) =>
    (await prisma.attachment.findUnique({ where: { id }, select: { card: { select: { boardId: true } } } }))?.card?.boardId,
};

const KIND_LABEL = {
  board: 'Board', list: 'List', card: 'Card', label: 'Label', checklist: 'Checklist',
  checklistItem: 'Checklist item', comment: 'Comment', attachment: 'Attachment',
};

const resolveBoardId = async (kind, id) => {
  const resolver = RESOLVERS[kind];
  if (!resolver) throw new Error(`Unknown board entity kind: ${kind}`);
  if (!id) return null;
  return resolver(id);
};

/**
 * Express middleware: resolves the board from `req.params[param]` (a board or a
 * child entity id), checks the caller's role is at least `min`, and sets
 *   req.board = { id, projectId, role }
 *
 * Usage: router.patch('/:id', authenticate, assertBoardRole('member', 'card'), handler)
 */
const assertBoardRole = (min, kind = 'board', param = 'id') => async (req, res, next) => {
  try {
    const boardId = await resolveBoardId(kind, req.params[param]);
    if (!boardId) throwError(`${KIND_LABEL[kind]} not found`, 404);

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      select: { id: true, projectId: true, archivedAt: true },
    });
    if (!board) throwError('Board not found', 404);

    const role = await getBoardRole(req.user.id, boardId, req.permissions);
    if (!role) throwError('You do not have access to this board', 403);
    if (!hasRole(role, min)) {
      throwError(min === 'owner' ? 'Only board owners can do this' : 'You have read-only access to this board', 403);
    }

    req.board = { id: board.id, projectId: board.projectId, archivedAt: board.archivedAt, role };
    next();
  } catch (error) {
    next(error);
  }
};

/** Build the service context from a request that passed assertBoardRole. */
const boardCtx = (req) => ({
  userId: req.user.id,
  permissions: req.permissions || [],
  boardId: req.board?.id,
  projectId: req.board?.projectId || null,
  role: req.board?.role,
});

module.exports = {
  ROLE_RANK,
  BOARD_ROLES,
  canManageAny,
  getBoardRole,
  hasRole,
  resolveBoardId,
  assertBoardRole,
  boardCtx,
};
