const prisma = require('../lib/prisma');
const logger = require('../utils/logger');
const { USER_LITE_SELECT, toActivity } = require('./boardFormat');

/**
 * Record an Activity row. Never throws — history must not break the mutation.
 * @param {Object} p
 * @param {string} p.type - e.g. 'card.created' (see docs/boards-contract.md)
 * @param {string} [p.boardId]
 * @param {string} [p.cardId]
 * @param {string} [p.projectId]
 * @param {Object} [p.data]
 * @param {string} [p.actorId]
 */
const log = async ({ type, boardId = null, cardId = null, projectId = null, data = null, actorId = null }) => {
  try {
    return await prisma.activity.create({ data: { type, boardId, cardId, projectId, data, actorId } });
  } catch (error) {
    logger.error(`Activity log failed (${type}): ${error.message}`);
    return null;
  }
};

/** Log several activities; never throws. */
const logMany = async (entries) => {
  if (!entries.length) return;
  try {
    await prisma.activity.createMany({
      data: entries.map(({ type, boardId = null, cardId = null, projectId = null, data = null, actorId = null }) => ({
        type, boardId, cardId, projectId, data, actorId,
      })),
    });
  } catch (error) {
    logger.error(`Activity logMany failed: ${error.message}`);
  }
};

/**
 * Cursor-paginated feed, newest first.
 * @returns {{ items: Object[], nextCursor: string|null }}
 */
const list = async (where, { cursor, limit } = {}) => {
  const take = Math.min(Math.max(Number(limit) || 30, 1), 100);
  const rows = await prisma.activity.findMany({
    where,
    include: { actor: USER_LITE_SELECT },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(cursor ? { cursor: { id: String(cursor) }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const items = (hasMore ? rows.slice(0, take) : rows).map(toActivity);
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
};

module.exports = { log, logMany, list };
