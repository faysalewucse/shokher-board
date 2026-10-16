const crypto = require('crypto');
const auditLogService = require('../services/auditLogService');

/**
 * Audit Middleware
 * Adds request tracking context for audit logging
 *
 * Adds to req:
 * - req.id: Unique request ID for correlation
 * - req.audit: Helper function to log audit entries
 *
 * @example
 * router.post('/widgets',
 *   authenticate,
 *   auditMiddleware,
 *   async (req, res) => {
 *     const widget = await createWidget(req.body);
 *     await req.audit.logCreate({
 *       entityId: widget.id,
 *       entityType: 'Widget',
 *       data: widget,
 *     });
 *     return successResponse(res, { data: widget });
 *   }
 * );
 */

const auditMiddleware = (req, res, next) => {
  // Generate unique request ID for correlation
  req.id = req.headers['x-request-id'] || crypto.randomUUID();

  // Extract IP address (handle proxy scenarios)
  req.ipAddress =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress;

  // Extract user agent
  req.userAgent = req.headers['user-agent'];

  /**
   * Audit logging helper attached to request
   */
  req.audit = {
    /**
     * Log a create action
     */
    logCreate: async ({ entityId, entityType, data }) => {
      return auditLogService.logCreate({
        entityId,
        entityType,
        actorId: req.user?.id,
        data,
        ipAddress: req.ipAddress,
        userAgent: req.userAgent,
        requestId: req.id,
      });
    },

    /**
     * Log an update action with before/after data
     */
    logUpdate: async ({ entityId, entityType, before, after, changedFields = null, reason }) => {
      return auditLogService.logUpdate({
        entityId,
        entityType,
        actorId: req.user?.id,
        before,
        after,
        changedFields,
        ipAddress: req.ipAddress,
        userAgent: req.userAgent,
        requestId: req.id,
        reason,
      });
    },

    /**
     * Log a delete action
     */
    logDelete: async ({ entityId, entityType, before, reason }) => {
      return auditLogService.logDelete({
        entityId,
        entityType,
        actorId: req.user?.id,
        before,
        ipAddress: req.ipAddress,
        userAgent: req.userAgent,
        requestId: req.id,
        reason,
      });
    },

    /**
     * Log a status change
     */
    logStatusChange: async ({ entityId, entityType, from, to, reason }) => {
      return auditLogService.logStatusChange({
        entityId,
        entityType,
        actorId: req.user?.id,
        from,
        to,
        ipAddress: req.ipAddress,
        userAgent: req.userAgent,
        requestId: req.id,
        reason,
      });
    },

    /**
     * Log a custom action
     */
    log: async ({ entityId, entityType, action, changes, reason }) => {
      return auditLogService.create({
        entityId,
        entityType,
        action,
        actorId: req.user?.id,
        changes,
        ipAddress: req.ipAddress,
        userAgent: req.userAgent,
        requestId: req.id,
        reason,
      });
    },
  };

  // Expose request ID in response header for debugging
  res.setHeader('X-Request-ID', req.id);

  next();
};

module.exports = auditMiddleware;
