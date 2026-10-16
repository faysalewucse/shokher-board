const slackService = require('../services/slackService');
const logger = require('../utils/logger');
const { successResponse } = require('../utils/responseHandler');

const requestMeta = (req) => ({ ipAddress: req.ip, userAgent: req.get('user-agent') || null });

// ── Current user ─────────────────────────────────────────────────────────────

const getMySlack = async (req, res, next) => {
  try {
    const data = await slackService.getMyStatus(req.user.id);
    return successResponse(res, { message: 'Slack connections fetched', data });
  } catch (error) { next(error); }
};

const startSlackInstall = async (req, res, next) => {
  try {
    const url = slackService.getInstallUrl(req.user.id);
    return successResponse(res, { message: 'Slack authorize URL created', data: { url } });
  } catch (error) { next(error); }
};

// Public: Slack redirects the browser here. Always answer with a redirect back
// to the portal (never JSON) so the user lands on their profile page.
const slackCallback = async (req, res) => {
  try {
    const { workspace } = await slackService.handleCallback(req.query, requestMeta(req));
    return res.redirect(slackService.portalReturnUrl({ slack: 'connected', team: workspace.teamName }));
  } catch (error) {
    logger.warn(`Slack connect failed: ${error.message}`);
    const slackCode = error.message.match(/failed: ([a-z_]+)$/)?.[1];
    const reason = /^[a-z_]+$/.test(error.message) ? error.message : (slackCode ? `slack_${slackCode}` : 'connect_failed');
    return res.redirect(slackService.portalReturnUrl({ slack: 'error', reason }));
  }
};

const testMySlack = async (req, res, next) => {
  try {
    const data = await slackService.testConnection(req.params.id, req.user.id);
    return successResponse(res, { message: 'Slack connection is working', data });
  } catch (error) { next(error); }
};

const disconnectMySlack = async (req, res, next) => {
  try {
    const data = await slackService.disconnect(req.params.id, {
      userId: req.user.id, actorId: req.user.id, meta: requestMeta(req),
    });
    return successResponse(res, { message: 'Slack disconnected', data });
  } catch (error) { next(error); }
};

// ── Admin ────────────────────────────────────────────────────────────────────

const getSlackOverview = async (req, res, next) => {
  try {
    const data = await slackService.getAdminOverview();
    return successResponse(res, { message: 'Slack integration overview fetched', data });
  } catch (error) { next(error); }
};

const adminDisconnectSlack = async (req, res, next) => {
  try {
    const data = await slackService.disconnect(req.params.id, { actorId: req.user.id, meta: requestMeta(req) });
    return successResponse(res, { message: 'Slack connection removed', data });
  } catch (error) { next(error); }
};

module.exports = {
  getMySlack, startSlackInstall, slackCallback, testMySlack, disconnectMySlack,
  getSlackOverview, adminDisconnectSlack,
};
