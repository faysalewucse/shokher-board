const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

/**
 * Audit Log Service
 * Tracks all changes across the system for compliance, debugging, and history
 *
 * @example
 * await auditLog.create({
 *   entityId: user.id,
 *   entityType: 'User',
 *   action: 'updated',
 *   actorId: req.user.id,
 *   changes: { before: { title: 'Old' }, after: { title: 'New' } },
 *   requestId: req.id,
 * });
 */

class AuditLogService {
  /**
   * Create an audit log entry
   * @param {object} params - Audit log parameters
   * @param {string} params.entityId - ID of the record that changed
   * @param {string} params.entityType - Model name (User, Role, Config, etc.)
   * @param {string} params.action - Action performed (created, updated, deleted, etc.)
   * @param {string} [params.actorId] - User who made the change
   * @param {object} [params.changes] - Change details { before, after } or specific fields
   * @param {string} [params.ipAddress] - IP address of requester
   * @param {string} [params.userAgent] - Browser/client identifier
   * @param {string} [params.requestId] - Correlation ID for grouping
   * @param {string} [params.reason] - Reason for the change
   * @returns {Promise<object>}
   */
  async create({
    entityId,
    entityType,
    action,
    actorId = null,
    changes = null,
    ipAddress = null,
    userAgent = null,
    requestId = null,
    reason = null,
  }) {
    try {
      return await prisma.auditLog.create({
        data: {
          entityId,
          entityType,
          action,
          actorId,
          changes,
          ipAddress,
          userAgent,
          requestId,
          reason,
        },
      });
    } catch (error) {
      // Fail silently - don't break operations if audit logging fails
      logger.error(`AuditLog create failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Log a create action
   */
  async logCreate({ entityId, entityType, actorId, data, ipAddress, userAgent, requestId }) {
    return this.create({
      entityId,
      entityType,
      action: 'created',
      actorId,
      changes: { after: data },
      ipAddress,
      userAgent,
      requestId,
    });
  }

  /**
   * Log an update action with before/after data
   */
  async logUpdate({ entityId, entityType, actorId, before, after, changedFields = null, ipAddress, userAgent, requestId, reason }) {
    const changes = changedFields
      ? { fields: changedFields, before, after }
      : { before, after };

    return this.create({
      entityId,
      entityType,
      action: 'updated',
      actorId,
      changes,
      ipAddress,
      userAgent,
      requestId,
      reason,
    });
  }

  /**
   * Log a delete action
   */
  async logDelete({ entityId, entityType, actorId, before, ipAddress, userAgent, requestId, reason }) {
    return this.create({
      entityId,
      entityType,
      action: 'deleted',
      actorId,
      changes: { before },
      ipAddress,
      userAgent,
      requestId,
      reason,
    });
  }

  /**
   * Log a status change
   */
  async logStatusChange({ entityId, entityType, actorId, from, to, ipAddress, userAgent, requestId, reason }) {
    return this.create({
      entityId,
      entityType,
      action: 'status_changed',
      actorId,
      changes: { from, to },
      ipAddress,
      userAgent,
      requestId,
      reason,
    });
  }

  /**
   * Get audit history for an entity
   * @param {string} entityType - Model name
   * @param {string} entityId - Record ID
   * @param {object} [options] - Query options
   * @param {number} [options.limit] - Max records to return
   * @param {number} [options.offset] - Pagination offset
   * @returns {Promise<Array>}
   */
  async getEntityHistory(entityType, entityId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    return await prisma.auditLog.findMany({
      where: { entityType, entityId },
      include: {
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get audit logs by actor (user)
   * @param {string} actorId - User ID
   * @param {object} [options] - Query options
   * @returns {Promise<Array>}
   */
  async getByActor(actorId, options = {}) {
    const { limit = 100, offset = 0, entityType, action } = options;

    return await prisma.auditLog.findMany({
      where: {
        actorId,
        ...(entityType && { entityType }),
        ...(action && { action }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get all audit logs with filtering
   * @param {object} [filters] - Filter options
   * @returns {Promise<Array>}
   */
  async getAll(filters = {}) {
    const { entityType, action, actorId, startDate, endDate, limit = 100, offset = 0 } = filters;

    const where = {
      ...(entityType && { entityType }),
      ...(action && { action }),
      ...(actorId && { actorId }),
      ...(startDate || endDate ? {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get actor stats (audit trail summary for a user)
   * @param {string} actorId - User ID
   * @returns {Promise<object>}
   */
  async getActorStats(actorId) {
    const stats = await prisma.auditLog.groupBy({
      by: ['action', 'entityType'],
      where: { actorId },
      _count: true,
    });

    return stats.reduce((acc, item) => {
      const key = `${item.entityType}_${item.action}`;
      acc[key] = item._count;
      return acc;
    }, {});
  }
}

// Export singleton instance
const auditLogService = new AuditLogService();

module.exports = auditLogService;
