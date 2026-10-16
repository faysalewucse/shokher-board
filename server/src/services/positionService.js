/**
 * Fractional ordering helpers. Clients send the new position (midpoint of the
 * neighbours, or neighbour ± 1024 at either end). When two neighbours end up
 * closer than MIN_GAP, the whole scope is re-spaced to multiples of GAP.
 */
const prisma = require('../lib/prisma');

const GAP = 1024;
const MIN_GAP = 0.001;

// model → how to scope siblings and what to return in `items`
const SCOPES = {
  list: { key: 'list', scope: (row) => ({ boardId: row.boardId, archivedAt: null }) },
  card: { key: 'card', scope: (row) => ({ listId: row.listId, archivedAt: null }), withListId: true },
  checklist: { key: 'checklist', scope: (row) => ({ cardId: row.cardId }) },
  checklistItem: { key: 'checklistItem', scope: (row) => ({ checklistId: row.checklistId }) },
};

/** Position after the last sibling (GAP when the scope is empty). */
const endPosition = async (model, where) => {
  const last = await prisma[SCOPES[model].key].findFirst({
    where,
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return (last?.position ?? 0) + GAP;
};

/**
 * Re-space siblings when `row` sits within MIN_GAP of a neighbour.
 * @param {'list'|'card'|'checklist'|'checklistItem'} model
 * @param {Object} row - the moved row (needs id, position and its scope fields)
 * @returns {Promise<Array<{id, position, listId?}>|null>} new positions, or null if untouched
 */
const rebalanceIfNeeded = async (model, row) => {
  const cfg = SCOPES[model];
  const delegate = prisma[cfg.key];
  const where = cfg.scope(row);

  const [prev, next] = await Promise.all([
    delegate.findFirst({
      where: { ...where, id: { not: row.id }, position: { lte: row.position } },
      orderBy: { position: 'desc' },
      select: { position: true },
    }),
    delegate.findFirst({
      where: { ...where, id: { not: row.id }, position: { gte: row.position } },
      orderBy: { position: 'asc' },
      select: { position: true },
    }),
  ]);

  const tooClose =
    (prev && row.position - prev.position < MIN_GAP) ||
    (next && next.position - row.position < MIN_GAP);
  if (!tooClose) return null;

  const siblings = await delegate.findMany({
    where,
    orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
    select: { id: true, ...(cfg.withListId ? { listId: true } : {}) },
  });

  const items = siblings.map((s, i) => ({ ...s, position: (i + 1) * GAP }));
  await prisma.$transaction(items.map((it) => delegate.update({ where: { id: it.id }, data: { position: it.position } })));
  return items.map((it) => (cfg.withListId ? { id: it.id, position: it.position, listId: it.listId } : { id: it.id, position: it.position }));
};

module.exports = { GAP, MIN_GAP, endPosition, rebalanceIfNeeded };
