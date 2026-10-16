/**
 * Board-related notifications (card.assigned, card.mentioned, card.due_soon).
 * Reuses notificationService so they are persisted and pushed live.
 */
const notificationService = require('./notificationService');
const logger = require('../utils/logger');

const cardUrl = (boardId, cardId) => `/boards/${boardId}?card=${cardId}`;

const TEMPLATES = {
  'card.assigned': ({ actorName, title }) => ({
    title: 'You were assigned to a card',
    message: `${actorName || 'Someone'} assigned you to "${title}"`,
  }),
  'card.mentioned': ({ actorName, title }) => ({
    title: 'You were mentioned in a comment',
    message: `${actorName || 'Someone'} mentioned you on "${title}"`,
  }),
  'card.due_soon': ({ title, dueDate }) => ({
    title: 'Card due soon',
    message: `"${title}" is due ${dueDate ? new Date(dueDate).toLocaleString() : 'soon'}`,
  }),
};

/**
 * Notify users about a card. Failures are logged, never thrown.
 * @param {'card.assigned'|'card.mentioned'|'card.due_soon'} type
 * @param {string[]} userIds
 * @param {{ id, boardId, title, dueDate? }} card
 * @param {{ actorId?, actorName? }} [opts] - actorId is excluded from recipients
 */
const notifyCardUsers = async (type, userIds, card, { actorId = null, actorName = null } = {}) => {
  const recipients = [...new Set(userIds)].filter((id) => id && id !== actorId);
  if (!recipients.length) return;
  const { title, message } = TEMPLATES[type]({ actorName, title: card.title, dueDate: card.dueDate });
  await Promise.all(
    recipients.map((userId) =>
      notificationService
        .createNotification({
          userId,
          type,
          title,
          message,
          data: { boardId: card.boardId, cardId: card.id },
          priority: type === 'card.due_soon' ? 'high' : 'normal',
          actionUrl: cardUrl(card.boardId, card.id),
          actionLabel: 'Open card',
        })
        .catch((err) => logger.error(`Notify ${type} → ${userId} failed: ${err.message}`)),
    ),
  );
};

module.exports = { notifyCardUsers, cardUrl };
