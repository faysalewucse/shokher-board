const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const notificationValidation = require('../validations/notificationValidation');
const {
  list,
  unreadCount,
  markRead,
  markAllRead,
  remove,
  cleanup,
  broadcast,
} = require('../controllers/notificationController');

const router = express.Router();

// Admin routes — registered before '/:id' so 'cleanup' isn't captured as an id.
router.delete('/cleanup',  authenticate, authorize('SYSTEM_MANAGE'), cleanup);
router.post('/broadcast',  authenticate, authorize('NOTIFICATION_SEND'), validate(notificationValidation.broadcast), broadcast);

// Scoped to the authenticated user.
router.get('/',              authenticate, list);
router.get('/unread-count',  authenticate, unreadCount);
router.patch('/read-all',    authenticate, markAllRead);
router.patch('/:id/read',    authenticate, markRead);
router.delete('/:id',        authenticate, remove);

module.exports = router;
