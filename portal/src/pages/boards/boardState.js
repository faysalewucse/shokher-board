import { createContext, useContext } from 'react';
import { byPosition } from './positions';

/** Shared board state for child components (header, lists, card modal). */
export const BoardContext = createContext(null);
export const useBoard = () => useContext(BoardContext);

export const initialBoardState = { board: null, members: [], labels: [], lists: [], cards: [] };

const upsert = (arr, item, key = 'id') => {
  const idx = arr.findIndex((x) => x[key] === item[key]);
  if (idx === -1) return [...arr, item];
  const next = arr.slice();
  next[idx] = { ...arr[idx], ...item };
  return next;
};

const applyPositions = (arr, items) => {
  const map = new Map(items.map((i) => [i.id, i]));
  return arr.map((x) => {
    const u = map.get(x.id);
    if (!u) return x;
    return { ...x, position: u.position, ...(u.listId ? { listId: u.listId } : {}) };
  });
};

export function boardReducer(state, action) {
  switch (action.type) {
    case 'load': {
      const { board, members = [], labels = [], lists = [], cards = [] } = action.data || {};
      return { board, members, labels, lists: lists.slice().sort(byPosition), cards };
    }
    case 'board/patch':
      return { ...state, board: { ...state.board, ...action.patch } };

    case 'member/upsert':
      return { ...state, members: upsert(state.members, action.member, 'userId') };
    case 'member/remove':
      return {
        ...state,
        members: state.members.filter((m) => m.userId !== action.userId),
        cards: state.cards.map((c) =>
          c.assignees?.some((a) => a.id === action.userId)
            ? { ...c, assignees: c.assignees.filter((a) => a.id !== action.userId) }
            : c,
        ),
      };

    case 'label/upsert':
      return { ...state, labels: upsert(state.labels, action.label) };
    case 'label/remove':
      return {
        ...state,
        labels: state.labels.filter((l) => l.id !== action.id),
        cards: state.cards.map((c) =>
          c.labelIds?.includes(action.id) ? { ...c, labelIds: c.labelIds.filter((id) => id !== action.id) } : c,
        ),
      };

    case 'list/upsert': {
      if (action.list.archivedAt) {
        return boardReducer(state, { type: 'list/remove', id: action.list.id });
      }
      return { ...state, lists: upsert(state.lists, action.list).sort(byPosition) };
    }
    case 'list/remove':
      return {
        ...state,
        lists: state.lists.filter((l) => l.id !== action.id),
        cards: state.cards.filter((c) => c.listId !== action.id),
      };
    case 'lists/reorder':
      return { ...state, lists: applyPositions(state.lists, action.items).sort(byPosition) };

    case 'card/upsert': {
      if (action.card.archivedAt) return boardReducer(state, { type: 'card/remove', id: action.card.id });
      return { ...state, cards: upsert(state.cards, action.card) };
    }
    case 'card/patch':
      return {
        ...state,
        cards: state.cards.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case 'card/counts':
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.id === action.id ? { ...c, counts: { ...c.counts, ...action.counts(c.counts || {}) } } : c,
        ),
      };
    case 'card/remove':
      return { ...state, cards: state.cards.filter((c) => c.id !== action.id) };
    case 'cards/reorder':
      return { ...state, cards: applyPositions(state.cards, action.items) };

    default:
      return state;
  }
}
