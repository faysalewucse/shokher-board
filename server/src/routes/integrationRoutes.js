const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getMySlack, startSlackInstall, slackCallback, testMySlack, disconnectMySlack,
  getSlackOverview, adminDisconnectSlack,
} = require('../controllers/integrationController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public OAuth callback (Slack redirects the browser here) — keep it throttled.
const callbackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
const installLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

// Any signed-in user: connect / manage their own Slack workspaces.
router.get('/slack',                          authenticate, getMySlack);
router.post('/slack/install',                 authenticate, installLimiter, startSlackInstall);
router.get('/slack/callback',                 callbackLimiter, slackCallback);
router.post('/slack/connections/:id/test',    authenticate, testMySlack);
router.delete('/slack/connections/:id',       authenticate, disconnectMySlack);

// Admins: overview of every connection, and remove any of them.
router.get('/slack/admin',                    authenticate, authorize('SETTINGS_READ'),   getSlackOverview);
router.delete('/slack/admin/connections/:id', authenticate, authorize('SETTINGS_UPDATE'), adminDisconnectSlack);

module.exports = router;
