const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const { emitToBoard } = require('../lib/socket');
const activity = require('./activityService');
const { notifyCardUsers } = require('./boardNotify');
const { extractMentions } = require('./messageParser');
const { USER_LITE_SELECT, toComment } = require('./boardFormat');

const COMMENT_INCLUDE = { author: USER_LITE_SELECT };

/** Newest first. */
const listComments = async (cardId) => {
  const comments = await prisma.comment.findMany({
    where: { cardId },
    include: COMMENT_INCLUDE,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
  return comments.map(toComment);
};

const createComment = async (cardId, { body }, ctx) => {
  const card = await prisma.card.findUnique({ where: { id: cardId }, select: { id: true, boardId: true, title: true } });
  if (!card) throwError('Card not found', 404);

  const comment = await prisma.comment.create({
    data: { cardId, body, authorId: ctx.userId },
    include: COMMENT_INCLUDE,
  });

  await activity.log({
    type: 'comment.created', boardId: card.boardId, cardId, projectId: ctx.projectId, actorId: ctx.userId,
    data: { commentId: comment.id },
  });

  // @Name mentions of board members → notification
  const members = await prisma.boardMember.findMany({
    where: { boardId: card.boardId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  const mentioned = extractMentions(body, members.map((m) => m.user));
  if (mentioned.length) {
    await notifyCardUsers('card.mentioned', mentioned, card, { actorId: ctx.userId, actorName: comment.author?.name });
  }

  const payload = toComment(comment);
  emitToBoard(card.boardId, 'comment.created', payload, ctx.userId);
  return payload;
};

const loadComment = async (id) => {
  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { card: { select: { boardId: true } } },
  });
  if (!comment) throwError('Comment not found', 404);
  return comment;
};

const updateComment = async (id, { body }, ctx) => {
  const existing = await loadComment(id);
  if (existing.authorId !== ctx.userId) throwError('Only the author can edit this comment', 403);

  const comment = await prisma.comment.update({
    where: { id },
    data: { body, editedAt: new Date() },
    include: COMMENT_INCLUDE,
  });
  const payload = toComment(comment);
  emitToBoard(existing.card.boardId, 'comment.updated', payload, ctx.userId);
  return payload;
};

const deleteComment = async (id, ctx) => {
  const existing = await loadComment(id);
  if (existing.authorId !== ctx.userId && ctx.role !== 'owner') {
    throwError('Only the author or a board owner can delete this comment', 403);
  }
  await prisma.comment.delete({ where: { id } });
  emitToBoard(existing.card.boardId, 'comment.deleted', { id, cardId: existing.cardId }, ctx.userId);
};

module.exports = { listComments, createComment, updateComment, deleteComment };
