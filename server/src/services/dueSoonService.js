const prisma = require('../lib/prisma');
const logger = require('../utils/logger');
const { notifyCardUsers } = require('./boardNotify');

/**
 * Notify assignees of cards due within `windowHours` that are not completed,
 * not archived and not yet notified; then stamp `dueNotifiedAt`.
 * Run hourly by the scheduler.
 */
const runDueSoonCheck = async (windowHours = 24) => {
  const now = new Date();
  const until = new Date(now.getTime() + windowHours * 60 * 60 * 1000);

  const cards = await prisma.card.findMany({
    where: {
      dueDate: { gte: now, lte: until },
      completedAt: null,
      archivedAt: null,
      dueNotifiedAt: null,
      board: { archivedAt: null },
      list: { archivedAt: null },
    },
    select: { id: true, boardId: true, title: true, dueDate: true, assignees: { select: { userId: true } } },
    take: 1000,
  });

  let notified = 0;
  for (const card of cards) {
    // Claim the card first so overlapping runs can't double-notify.
    const claimed = await prisma.card.updateMany({
      where: { id: card.id, dueNotifiedAt: null },
      data: { dueNotifiedAt: now },
    });
    if (!claimed.count) continue;
    const userIds = card.assignees.map((a) => a.userId);
    if (userIds.length) {
      await notifyCardUsers('card.due_soon', userIds, card);
      notified += userIds.length;
    }
  }

  if (cards.length) logger.info(`Due-soon check: ${cards.length} card(s), ${notified} notification(s)`);
  return { cards: cards.length, notified };
};

module.exports = { runDueSoonCheck };
