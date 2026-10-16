/**
 * Fractional ordering helpers (boards contract: "position is a Float").
 *
 * A moved item gets the midpoint of its new neighbours, or neighbour ± GAP
 * at either end. The server re-spaces a list/board once gaps fall below
 * 0.001 and broadcasts `lists:reordered` / `cards:reordered`.
 */
export const POSITION_GAP = 1024;

/** Position for an item placed between `prev` and `next` (either may be null). */
export function positionBetween(prev, next) {
  const hasPrev = typeof prev === 'number' && Number.isFinite(prev);
  const hasNext = typeof next === 'number' && Number.isFinite(next);
  if (!hasPrev && !hasNext) return POSITION_GAP;
  if (!hasPrev) return next - POSITION_GAP;
  if (!hasNext) return prev + POSITION_GAP;
  return (prev + next) / 2;
}

/** Position after the last of `items` (objects with `position`). */
export function positionAtEnd(items) {
  if (!items?.length) return POSITION_GAP;
  const max = Math.max(...items.map((i) => i.position));
  return max + POSITION_GAP;
}

/**
 * Position for `movedId` given the final ordered id list of its container.
 * `positionOf(id)` returns the current position of a sibling.
 */
export function positionForOrderedIds(orderedIds, movedId, positionOf) {
  const idx = orderedIds.indexOf(movedId);
  if (idx === -1) return null;
  const prevId = idx > 0 ? orderedIds[idx - 1] : null;
  const nextId = idx < orderedIds.length - 1 ? orderedIds[idx + 1] : null;
  return positionBetween(
    prevId != null ? positionOf(prevId) : null,
    nextId != null ? positionOf(nextId) : null,
  );
}

export const byPosition = (a, b) => a.position - b.position;
