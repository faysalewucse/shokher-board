/**
 * Import a Trello board export (already normalized by the portal) into a new
 * board in one transaction. Mapping rules live in ./trelloMapping (pure).
 * See docs/trello-import.md.
 */
const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const activity = require('./activityService');
const { BOARD_INCLUDE, toBoard } = require('./boardFormat');
const { buildImportPlan } = require('./trelloMapping');

const CHUNK = 1000;
const TX_OPTIONS = { timeout: 60000, maxWait: 10000 };

const createManyChunked = async (delegate, rows) => {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await delegate.createMany({ data: rows.slice(i, i + CHUNK) });
  }
};

/**
 * @param {Object} body - { name, projectId?, includeArchived, memberMap, data }
 * @param {Object} ctx - { userId }
 * @returns {Promise<{ board: Object, counts: Object }>}
 */
const importTrelloBoard = async ({ name, projectId, includeArchived = false, memberMap = {}, data }, { userId }) => {
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) throwError('Project not found', 400);
  }

  // Drop "don't map" entries, then require every mapped user to be active.
  const cleanMap = Object.fromEntries(Object.entries(memberMap || {}).filter(([, v]) => v));
  const mappedIds = [...new Set(Object.values(cleanMap))];
  if (mappedIds.length) {
    const users = await prisma.user.findMany({ where: { id: { in: mappedIds }, status: 'active' }, select: { id: true } });
    const found = new Set(users.map((u) => u.id));
    const missing = mappedIds.filter((id) => !found.has(id));
    if (missing.length) throwError(`Mapped user(s) not found or inactive: ${missing.join(', ')}`, 400);
  }

  const now = new Date();
  const board = await prisma.$transaction(async (tx) => {
    const created = await tx.board.create({
      data: {
        name,
        description: data.board?.desc?.trim() || null,
        projectId: projectId || null,
        createdById: userId,
      },
    });
    const plan = buildImportPlan(data, { boardId: created.id, importerId: userId, includeArchived, memberMap: cleanMap, now });

    await tx.boardMember.createMany({
      data: [
        { boardId: created.id, userId, role: 'owner' },
        ...plan.memberUserIds.map((u) => ({ boardId: created.id, userId: u, role: 'member' })),
      ],
    });
    await createManyChunked(tx.list, plan.lists);
    await createManyChunked(tx.label, plan.labels);
    await createManyChunked(tx.card, plan.cards);
    await createManyChunked(tx.cardAssignee, plan.cardAssignees);
    await createManyChunked(tx.cardLabel, plan.cardLabels);
    await createManyChunked(tx.checklist, plan.checklists);
    await createManyChunked(tx.checklistItem, plan.checklistItems);
    await createManyChunked(tx.comment, plan.comments);
    await createManyChunked(tx.attachment, plan.attachments);

    const full = await tx.board.findUnique({ where: { id: created.id }, include: BOARD_INCLUDE });
    return { ...full, counts: plan.counts };
  }, TX_OPTIONS);

  const { counts, ...boardRow } = board;
  await activity.log({
    type: 'board.imported',
    boardId: boardRow.id,
    projectId: boardRow.projectId,
    actorId: userId,
    data: { source: 'trello', name: boardRow.name, counts },
  });

  return { board: toBoard(boardRow, 'owner'), counts };
};

module.exports = { importTrelloBoard };
