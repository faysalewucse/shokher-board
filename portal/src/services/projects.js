import api from './api';

/**
 * Clients & Projects API wrappers (see server/docs/boards-contract.md).
 * Every function resolves to the envelope's `data`.
 */
const unwrap = (res) => res.data?.data;

// ── Clients ──────────────────────────────────────────────────────────────
/** `params`: `{ q?, archived? }` — each client carries `projectCount`. */
export const getClients = (params = {}) => api.get('/clients', { params }).then(unwrap);
/** Includes `projects` (active, newest first). */
export const getClient = (id) => api.get(`/clients/${id}`).then(unwrap);
export const createClient = (body) => api.post('/clients', body).then(unwrap);
export const updateClient = (id, body) => api.patch(`/clients/${id}`, body).then(unwrap);
/** Archives the client (soft delete). */
export const archiveClient = (id) => api.delete(`/clients/${id}`).then(unwrap);

// ── Projects ─────────────────────────────────────────────────────────────
/** `params`: `{ clientId?, status?, q?, archived? }` — includes `boardCount` and `progress`. */
export const getProjects = (params = {}) => api.get('/projects', { params }).then(unwrap);
/** Includes the `boards` the caller can see, plus `progress`. */
export const getProject = (id) => api.get(`/projects/${id}`).then(unwrap);
export const createProject = (body) => api.post('/projects', body).then(unwrap);
export const updateProject = (id, body) => api.patch(`/projects/${id}`, body).then(unwrap);
/** Archives the project (soft delete). */
export const archiveProject = (id) => api.delete(`/projects/${id}`).then(unwrap);
