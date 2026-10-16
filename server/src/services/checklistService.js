const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const { emitToBoard } = require('../lib/socket');
const activity = require('./activityService');
const { endPosition, rebalanceIfNeeded } = require('./positionService');
const { getCardSummary, toChecklist, toChecklistItem } = require('./boardFormat');

// Every checklist mutation broadcasts `checklist.changed` with the CardSummary.
const emitChanged = async (cardId, ctx) => {
  const summary = await getCardSummary(cardId);
  emitToBoard(summary.boardId, 'checklist.changed', summary, ctx.userId);
};

const ITEM_ORDER = { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] };

const loadChecklist = async (id) => {
  const checklist = await prisma.checklist.findUnique({ where: { id }, include: { items: ITEM_ORDER } });
  if (!checklist) throwError('Checklist not found', 404);
  return checklist;
};

const createChecklist = async (cardId, { title }, ctx) => {
  const position = await endPosition('checklist', { cardId });
  const checklist = await prisma.checklist.create({ data: { cardId, title, position }, include: { items: true } });
  await emitChanged(cardId, ctx);
  return toChecklist(checklist);
};

const updateChecklist = async (id, data, ctx) => {
  const updated = await prisma.checklist.update({ where: { id }, data });
  if (data.position !== undefined) await rebalanceIfNeeded('checklist', updated);
  await emitChanged(updated.cardId, ctx);
  return toChecklist(await loadChecklist(id));
};

const deleteChecklist = async (id, ctx) => {
  const checklist = await prisma.checklist.delete({ where: { id } });
  await emitChanged(checklist.cardId, ctx);
};

const createItem = async (checklistId, { text }, ctx) => {
  const checklist = await prisma.checklist.findUnique({ where: { id: checklistId }, select: { cardId: true } });
  if (!checklist) throwError('Checklist not found', 404);
  const position = await endPosition('checklistItem', { checklistId });
  const item = await prisma.checklistItem.create({ data: { checklistId, text, position } });
  await emitChanged(checklist.cardId, ctx);
  return toChecklistItem(item);
};

const updateItem = async (id, body, ctx) => {
  const existing = await prisma.checklistItem.findUnique({
    where: { id },
    include: { checklist: { select: { cardId: true, card: { select: { boardId: true } } } } },
  });
  if (!existing) throwError('Checklist item not found', 404);
  const { cardId } = existing.checklist;
  const { boardId } = existing.checklist.card;

  if (body.assigneeId) {
    const member = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId, userId: body.assigneeId } },
      select: { id: true },
    });
    if (!member) throwError('Assignee must be a member of the board', 400);
  }

  const data = {};
  for (const key of ['text', 'isDone', 'position', 'assigneeId', 'dueDate']) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  let item = await prisma.checklistItem.update({ where: { id }, data });
  if (data.position !== undefined && (await rebalanceIfNeeded('checklistItem', item))) {
    item = await prisma.checklistItem.findUnique({ where: { id } });
  }

  if (data.isDone === true && !existing.isDone) {
    await activity.log({
      type: 'checklist.item_done', boardId, cardId, projectId: ctx.projectId, actorId: ctx.userId,
      data: { itemId: id, text: item.text },
    });
  }

  await emitChanged(cardId, ctx);
  return toChecklistItem(item);
};

const deleteItem = async (id, ctx) => {
  const item = await prisma.checklistItem.delete({
    where: { id },
    include: { checklist: { select: { cardId: true } } },
  });
  await emitChanged(item.checklist.cardId, ctx);
};

module.exports = { createChecklist, updateChecklist, deleteChecklist, createItem, updateItem, deleteItem };
