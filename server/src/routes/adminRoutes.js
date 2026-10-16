const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { triggerCleanup, getStorageInfo } = require('../controllers/adminController');

const router = express.Router();

// Trigger manual file cleanup
router.post(
  '/cleanup-files',
  authenticate,
  authorize('SYSTEM_MANAGE'),
  triggerCleanup
);

// Get storage statistics
router.get(
  '/storage-stats',
  authenticate,
  authorize('SYSTEM_MANAGE'),
  getStorageInfo
);

module.exports = router;
