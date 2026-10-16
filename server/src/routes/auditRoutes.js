const express = require('express');
const auditLogService = require('../services/auditLogService');
const { authenticate, authorize } = require('../middleware/auth');
const { successResponse } = require('../utils/responseHandler');

const router = express.Router();

// GET /audit-logs — paginated list with filters
router.get('/', authenticate, authorize('AUDIT_READ'), async (req, res, next) => {
  try {
    const { entityType, action, actorId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { logs, total } = await auditLogService.getAll({
      entityType,
      action,
      actorId,
      startDate,
      endDate,
      limit: Number(limit),
      offset,
    });

    return successResponse(res, {
      message: 'Audit logs fetched',
      data: logs,
      meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) {
    next(err);
  }
});

// GET /audit-logs/entity/:type/:id — history for a specific record
router.get('/entity/:type/:id', authenticate, authorize('AUDIT_READ'), async (req, res, next) => {
  try {
    const logs = await auditLogService.getEntityHistory(req.params.type, req.params.id);
    return successResponse(res, { message: 'Entity history fetched', data: logs });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
