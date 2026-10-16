const express = require('express');
const { authenticate, authorize }  = require('../middleware/auth');
const { PERMISSIONS, PERMISSION_GROUPS } = require('../constants/permissions');
const { successResponse } = require('../utils/responseHandler');

const router = express.Router();

// GET /permissions — returns grouped permissions with descriptions for the ShokherBoard portal
router.get('/', authenticate, authorize('PERMISSION_READ'), (req, res) => {
  const groups = {};
  for (const [group, keys] of Object.entries(PERMISSION_GROUPS)) {
    groups[group] = keys.map((key) => ({
      key,
      description: PERMISSIONS[key]?.description || key,
    }));
  }
  return successResponse(res, { message: 'Permissions fetched', data: { groups } });
});

module.exports = router;
