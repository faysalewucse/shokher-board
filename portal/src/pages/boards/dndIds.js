// dnd-kit ids: cards use their raw id; lists/drop-zones are prefixed so they never collide.
export const LIST_WIDTH = 272;
export const listDndId = (listId) => `list:${listId}`;
export const dropDndId = (listId) => `drop:${listId}`;
