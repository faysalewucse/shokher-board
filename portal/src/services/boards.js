import api from './api';

/**
 * Thin wrappers over the Boards API (see server/docs/boards-contract.md).
 * Every function resolves to the envelope's `data` unless noted; list
 * endpoints with cursors resolve to `{ data, meta }`.
 */
const unwrap = (res) => res.data?.data;
const withMeta = (res) => ({ data: res.data?.data ?? [], meta: res.data?.meta ?? {} });

/** Pull a human-readable message out of an axios error. */
export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.message || err?.message || fallback;

// ── Users ────────────────────────────────────────────────────────────────
export const lookupUsers = (q = '', limit = 20) =>
  api.get('/users/lookup', { params: { q, limit } }).then(unwrap);

// ── Clients / Projects (full wrappers live in ./projects) ───────────────
export { getClients, getProjects } from './projects';

// ── Boards ───────────────────────────────────────────────────────────────
export const getBoards = (params = {}) => api.get('/boards', { params }).then(unwrap);
export const createBoard = (body) => api.post('/boards', body).then(unwrap);
/** Resolves to `{ board, members, labels, lists, cards }`. */
export const getBoard = (id) => api.get(`/boards/${id}`).then(unwrap);
export const updateBoard = (id, body) => api.patch(`/boards/${id}`, body).then(unwrap);
export const deleteBoard = (id) => api.delete(`/boards/${id}`).then(unwrap);

export const addBoardMember = (boardId, userId, role = 'member') =>
  api.post(`/boards/${boardId}/members`, { userId, role }).then(unwrap);
export const updateBoardMember = (boardId, userId, role) =>
  api.patch(`/boards/${boardId}/members/${userId}`, { role }).then(unwrap);
export const removeBoardMember = (boardId, userId) =>
  api.delete(`/boards/${boardId}/members/${userId}`).then(unwrap);

export const createLabel = (boardId, body) => api.post(`/boards/${boardId}/labels`, body).then(unwrap);
export const updateLabel = (id, body) => api.patch(`/labels/${id}`, body).then(unwrap);
export const deleteLabel = (id) => api.delete(`/labels/${id}`).then(unwrap);

/** Resolves to `{ data: Activity[], meta: { nextCursor } }`. */
export const getBoardActivity = (boardId, { cursor, limit = 30 } = {}) =>
  api.get(`/boards/${boardId}/activity`, { params: { cursor, limit } }).then(withMeta);

// ── Lists ────────────────────────────────────────────────────────────────
export const createList = (boardId, body) => api.post(`/boards/${boardId}/lists`, body).then(unwrap);
export const updateList = (id, body) => api.patch(`/lists/${id}`, body).then(unwrap);
export const deleteList = (id) => api.delete(`/lists/${id}`).then(unwrap);

// ── Cards ────────────────────────────────────────────────────────────────
export const createCard = (boardId, body) => api.post(`/boards/${boardId}/cards`, body).then(unwrap);
export const getCard = (id) => api.get(`/cards/${id}`).then(unwrap);
export const updateCard = (id, body) => api.patch(`/cards/${id}`, body).then(unwrap);
export const moveCard = (id, listId, position) =>
  api.patch(`/cards/${id}/move`, { listId, position }).then(unwrap);
export const deleteCard = (id) => api.delete(`/cards/${id}`).then(unwrap);
export const setCardAssignees = (id, userIds) =>
  api.put(`/cards/${id}/assignees`, { userIds }).then(unwrap);
export const setCardLabels = (id, labelIds) =>
  api.put(`/cards/${id}/labels`, { labelIds }).then(unwrap);
export const getCardActivity = (id) => api.get(`/cards/${id}/activity`).then(unwrap);

// Checklists
export const createChecklist = (cardId, title) =>
  api.post(`/cards/${cardId}/checklists`, { title }).then(unwrap);
export const updateChecklist = (id, body) => api.patch(`/checklists/${id}`, body).then(unwrap);
export const deleteChecklist = (id) => api.delete(`/checklists/${id}`).then(unwrap);
export const createChecklistItem = (checklistId, text) =>
  api.post(`/checklists/${checklistId}/items`, { text }).then(unwrap);
export const updateChecklistItem = (id, body) => api.patch(`/checklist-items/${id}`, body).then(unwrap);
export const deleteChecklistItem = (id) => api.delete(`/checklist-items/${id}`).then(unwrap);

// Comments
export const getComments = (cardId) => api.get(`/cards/${cardId}/comments`).then(unwrap);
export const createComment = (cardId, body) => api.post(`/cards/${cardId}/comments`, { body }).then(unwrap);
export const updateComment = (id, body) => api.patch(`/comments/${id}`, { body }).then(unwrap);
export const deleteComment = (id) => api.delete(`/comments/${id}`).then(unwrap);

// Attachments
export const uploadAttachment = (cardId, file, onProgress) => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post(`/cards/${cardId}/attachments`, form, {
      // Must not be application/json or axios would JSON-encode the FormData;
      // the browser replaces this with the real multipart boundary.
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    })
    .then(unwrap);
};
export const deleteAttachment = (id) => api.delete(`/attachments/${id}`).then(unwrap);

// ── Messages (message-to-card bar) ───────────────────────────────────────
/** Resolves to `{ data: Message[] (newest first), meta: { nextCursor } }`. */
export const getMessages = (boardId, { before, limit = 30 } = {}) =>
  api.get(`/boards/${boardId}/messages`, { params: { before, limit } }).then(withMeta);
export const postMessage = (boardId, text, listId) =>
  api.post(`/boards/${boardId}/messages`, { text, listId }).then(unwrap);
