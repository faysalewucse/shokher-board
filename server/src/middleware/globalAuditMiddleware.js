const crypto = require('crypto');
const auditLogService = require('../services/auditLogService');

// URL segment (after the API prefix) → entity type recorded in the audit log.
// Add an entry here (and in PRISMA_KEY) when you add a new audited resource.
const AUDITED_ROUTES = {
  users:  'User',
  roles:  'Role',
  config: 'Config',
  clients:  'Client',
  projects: 'Project',
  // Boards/lists/cards are tracked by the Activity model instead.
};

const METHOD_ACTION = {
  POST:   'created',
  PUT:    'updated',
  PATCH:  'updated',
  DELETE: 'deleted',
};

// Map entityType → prisma client key
const PRISMA_KEY = {
  Config: { key: 'config', singleton: true },
  User:   { key: 'user' },
  Role:   { key: 'role' },
  Client:  { key: 'client' },
  Project: { key: 'project' },
};

// Sub-resources that are modifications to the parent entity, not separate entity actions
const SUB_RESOURCES = new Set(['avatar', 'image', 'images']);

// Exact paths that handle their own audit logging in the controller
const SELF_AUDITED_PATHS = new Set([]);

// Never persist secrets into audit snapshots/diffs.
const SENSITIVE_KEYS = new Set([
  'password', 'currentPassword', 'newPassword',
  'emailVerificationToken', 'passwordResetToken',
]);
const redact = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : v;
  }
  return out;
};

const parseUrl = (url) => {
  const clean = url.split('?')[0].replace(/^\/api\/v\d+\//, '');
  const parts = clean.split('/').filter(Boolean);
  const entityType = AUDITED_ROUTES[parts[0]] || null;

  const knownWords = new Set(['public', 'me', 'status', 'my', 'verify', 'resend', 'approve', 'reject', 'assign', 'bulk']);
  const entityId = parts[1] && !knownWords.has(parts[1]) ? parts[1] : null;
  const sub = knownWords.has(parts[1]) ? parts[1] : (parts[2] || null);

  return { entityType, entityId, sub };
};

// Body field names that differ from DB column names
const INPUT_KEY_ALIASES = {
  role: 'roleId',
};

// Flatten nested object to dot-notation keys (max 3 levels)
const flattenObj = (obj, prefix = '', depth = 0) => {
  const result = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      result[key] = v;
    } else if (v !== null && typeof v === 'object' && depth < 3) {
      Object.assign(result, flattenObj(v, key, depth + 1));
    } else {
      result[key] = v;
    }
  }
  return result;
};

// Fetch record before mutation so we can diff what actually changed
const fetchBeforeState = async (entityType, entityId) => {
  try {
    const prisma = require('../lib/prisma');
    const info = PRISMA_KEY[entityType];
    if (!info) return null;
    if (info.singleton) return prisma[info.key].findFirst();
    if (!entityId) return null;

    return prisma[info.key].findUnique({ where: { id: entityId } });
  } catch { /* ignore */ }
  return null;
};

// Normalize empty-ish values so null / undefined / "" / [] all compare equal
const normalize = (v) => {
  if (v === undefined || v === '') return null;
  if (Array.isArray(v) && v.length === 0) return null;
  return v;
};
const valEqual = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

// Return only keys in input that differ from beforeState, plus their before values
const diffInput = (beforeState, input) => {
  if (!input) return { changed: input, before: null };
  if (!beforeState) return { changed: input, before: null }; // can't diff, show full input
  const flatBefore = flattenObj(beforeState);
  const flatInput  = flattenObj(input);
  const changed = {};
  const before  = {};
  for (const [k, v] of Object.entries(flatInput)) {
    const dbKey = INPUT_KEY_ALIASES[k] || k;
    if (!valEqual(flatBefore[dbKey], v)) {
      changed[k] = v;
      before[k]  = flatBefore[dbKey] !== undefined ? flatBefore[dbKey] : null;
    }
  }
  // If nothing differs, store nothing (don't fall back to full input)
  return { changed, before: Object.keys(before).length ? before : null };
};

const globalAuditMiddleware = async (req, res, next) => {
  if (!METHOD_ACTION[req.method]) return next();

  req.id = req.id || crypto.randomUUID();
  const ipAddress =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
  const userAgent = req.headers['user-agent'];

  const capturedUrl = req.originalUrl || req.url;
  const cleanPath = capturedUrl.split('?')[0].replace(/^\/api\/v\d+\//, '');
  if (SELF_AUDITED_PATHS.has(cleanPath)) return next();

  const { entityType, entityId, sub } = parseUrl(capturedUrl);

  // Fetch before-state for PATCH/PUT (diff) and DELETE (name snapshot, skip for sub-resources)
  let beforeState = null;
  const isSubResource = SUB_RESOURCES.has(sub);
  if (entityType && (req.method === 'PATCH' || req.method === 'PUT' || (req.method === 'DELETE' && !isSubResource))) {
    beforeState = redact(await fetchBeforeState(entityType, entityId));
  }

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    originalJson(body);

    // Use setImmediate to ensure audit logging doesn't interfere with response
    setImmediate(() => {
      try {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        if (!body?.success) return;
        if (!entityType) return;

        let action = METHOD_ACTION[req.method];
        if (sub === 'status') {
          action = 'status_changed';
        } else if (SUB_RESOURCES.has(sub)) {
          action = 'updated';
        }

        const resolvedEntityId = entityId || body?.data?.id || 'unknown';

        const changes = {};
        if (req.method === 'DELETE' && !isSubResource) {
          if (beforeState) changes.snapshot = beforeState;
        } else if (isSubResource) {
          // Label sub-resource operations meaningfully (e.g. images, pdf)
          changes.input = { [sub]: 'updated' };
        } else if (req.body && Object.keys(req.body).length) {
          const { changed, before } = diffInput(beforeState, redact(req.body));
          if (Object.keys(changed).length) {
            changes.input = changed;
            if (before) changes.before = before;
          }
        }

        // Skip logging updates that produced no detectable changes
        if (action === 'updated' && !changes.input && !changes.snapshot) return;

        if (body?.data) {
          changes.after = redact(body.data);
        }

        auditLogService.create({
          entityId: resolvedEntityId,
          entityType,
          action,
          actorId: req.user?.id || null,
          changes: Object.keys(changes).length ? changes : null,
          ipAddress,
          userAgent,
          requestId: req.id,
        }).catch(() => {});
      } catch (error) {
        // Silently ignore audit logging errors to prevent response interference
      }
    });
  };

  next();
};

module.exports = globalAuditMiddleware;
