const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const config = require('../config');
const logger = require('../utils/logger');
const { encrypt, decrypt } = require('../utils/crypto');
const { throwError } = require('../utils/responseHandler');
const auditLogService = require('./auditLogService');

// Slack via OAuth v2 ("Add to Slack"). Any signed-in user can connect their own
// Slack workspace to their ShokherBoard account. See docs/slack.md.
//   1. POST /integrations/slack/install → authorize URL with a signed `state`
//   2. Slack redirects the browser to GET /integrations/slack/callback
//   3. We exchange the code for the workspace bot token + the user's own token,
//      store both encrypted, and redirect back to the portal profile page.

const SLACK_API = 'https://slack.com/api';
const STATE_TTL = '10m';

// Bot scopes: what ShokherBoard's bot can do in the workspace.
const DEFAULT_BOT_SCOPES = [
  'chat:write',
  'chat:write.public',
  'channels:read',
  'groups:read',
  'users:read',
  'users:read.email',
  'team:read',
];
// User scopes: what ShokherBoard can do as the connecting person.
const DEFAULT_USER_SCOPES = ['users:read', 'users:read.email', 'chat:write'];

const splitScopes = (value, fallback) =>
  (value || fallback.join(',')).split(',').map((s) => s.trim()).filter(Boolean);

const slackConfig = () => ({
  clientId: process.env.SLACK_CLIENT_ID || '',
  clientSecret: process.env.SLACK_CLIENT_SECRET || '',
  redirectUri: process.env.SLACK_REDIRECT_URI || '',
  botScopes: splitScopes(process.env.SLACK_SCOPES, DEFAULT_BOT_SCOPES),
  userScopes: splitScopes(process.env.SLACK_USER_SCOPES, DEFAULT_USER_SCOPES),
});

/** Which required env vars are missing (empty array = ready to connect). */
const missingConfig = () => {
  const c = slackConfig();
  return [
    !c.clientId && 'SLACK_CLIENT_ID',
    !c.clientSecret && 'SLACK_CLIENT_SECRET',
    !c.redirectUri && 'SLACK_REDIRECT_URI',
  ].filter(Boolean);
};

/** Call a Slack Web API method. Throws a 502 with Slack's error code on failure. */
const callSlack = async (method, { token, body } = {}) => {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${SLACK_API}/${method}`, {
      method: 'POST',
      headers,
      body: new URLSearchParams(body || {}).toString(),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    throwError(`Could not reach Slack (${err.message})`, 502);
  }
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throwError(`Slack ${method} failed: ${json.error || res.status}`, 502);
  return json;
};

const safeDecrypt = (value, what) => {
  try {
    return decrypt(value);
  } catch {
    throwError(`Stored Slack ${what} can't be decrypted (was ENCRYPTION_KEY or JWT_SECRET changed?). Reconnect Slack.`, 500);
  }
};

// ── Formatting (never includes tokens) ───────────────────────────────────────

const formatWorkspace = (w) => w && ({
  id: w.id,
  teamId: w.teamId,
  name: w.teamName,
  domain: w.teamDomain,
  icon: w.teamIcon,
  url: w.teamDomain ? `https://${w.teamDomain}.slack.com` : null,
});

const formatConnection = (c) => ({
  id: c.id,
  workspace: formatWorkspace(c.workspace),
  slackUser: {
    id: c.slackUserId,
    name: c.slackUserName,
    avatar: c.slackUserAvatar,
    email: c.slackUserEmail,
  },
  scopes: c.userScopes,
  connectedAt: c.createdAt,
  updatedAt: c.updatedAt,
  ...(c.user ? { user: { id: c.user.id, name: c.user.name, email: c.user.email } } : {}),
});

// ── Read ─────────────────────────────────────────────────────────────────────

/** The current user's Slack status: is the server set up + their connections. */
const getMyStatus = async (userId) => {
  const connections = await prisma.slackConnection.findMany({
    where: { userId },
    include: { workspace: true },
    orderBy: { createdAt: 'asc' },
  });
  return {
    configured: missingConfig().length === 0,
    connections: connections.map(formatConnection),
  };
};

/** Admin overview: server config + every connection, grouped by workspace. */
const getAdminOverview = async () => {
  const c = slackConfig();
  const workspaces = await prisma.slackWorkspace.findMany({
    orderBy: { teamName: 'asc' },
    include: {
      connections: {
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  return {
    configured: missingConfig().length === 0,
    missing: missingConfig(),
    redirectUri: c.redirectUri || null,
    botScopes: c.botScopes,
    userScopes: c.userScopes,
    workspaces: workspaces.map((w) => ({
      ...formatWorkspace(w),
      connections: w.connections.map((conn) => formatConnection({ ...conn, workspace: null })),
    })),
    totalConnections: workspaces.reduce((n, w) => n + w.connections.length, 0),
  };
};

// ── Connect ──────────────────────────────────────────────────────────────────

/** Build the Slack authorize URL for the signed-in user. */
const getInstallUrl = (userId) => {
  const missing = missingConfig();
  if (missing.length) {
    throwError('Slack isn\'t set up on this ShokherBoard server yet. Ask an administrator.', 400);
  }

  const c = slackConfig();
  const state = jwt.sign(
    { sub: userId, purpose: 'slack_connect', nonce: crypto.randomBytes(8).toString('hex') },
    config.jwt.secret,
    { expiresIn: STATE_TTL },
  );
  const url = new URL('https://slack.com/oauth/v2/authorize');
  url.searchParams.set('client_id', c.clientId);
  url.searchParams.set('scope', c.botScopes.join(','));
  url.searchParams.set('user_scope', c.userScopes.join(','));
  url.searchParams.set('redirect_uri', c.redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
};

/**
 * Finish the OAuth flow for the user named in `state`: exchange the code, store
 * the workspace's bot token and this user's connection. Throws with a short
 * reason code (e.g. `invalid_state`) on failure.
 */
const handleCallback = async ({ code, state, error }, meta = {}) => {
  if (error) throwError(error === 'access_denied' ? 'access_denied' : `slack_${error}`, 400);
  if (!code || !state) throwError('missing_code', 400);

  let payload;
  try {
    payload = jwt.verify(state, config.jwt.secret);
  } catch {
    throwError('invalid_state', 400);
  }
  if (payload.purpose !== 'slack_connect') throwError('invalid_state', 400);

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, status: true } });
  if (!user || user.status !== 'active') throwError('invalid_state', 400);

  const c = slackConfig();
  const oauth = await callSlack('oauth.v2.access', {
    body: { code, client_id: c.clientId, client_secret: c.clientSecret, redirect_uri: c.redirectUri },
  });
  if (!oauth.access_token || !oauth.team?.id) throwError('no_bot_token', 502);
  const authedUser = oauth.authed_user || {};
  if (!authedUser.id) throwError('no_user', 502);

  // Workspace details (domain, icon) for a nicer card — optional.
  let team = {};
  try {
    team = (await callSlack('team.info', { token: oauth.access_token })).team || {};
  } catch (err) {
    logger.warn(`Slack team.info failed: ${err.message}`);
  }

  // The connecting person's Slack profile (name, avatar, email) — optional.
  let profile = {};
  try {
    const info = await callSlack('users.info', { token: oauth.access_token, body: { user: authedUser.id } });
    profile = info.user || {};
  } catch (err) {
    logger.warn(`Slack users.info failed: ${err.message}`);
  }

  const workspaceData = {
    teamName: oauth.team.name || team.name || 'Slack workspace',
    teamDomain: team.domain || null,
    teamIcon: team.icon?.image_132 || team.icon?.image_88 || null,
    enterpriseId: oauth.enterprise?.id || null,
    appId: oauth.app_id || null,
    botUserId: oauth.bot_user_id,
    botTokenEncrypted: encrypt(oauth.access_token),
    botScopes: String(oauth.scope || '').split(',').filter(Boolean),
  };

  const { workspace, connection } = await prisma.$transaction(async (tx) => {
    const ws = await tx.slackWorkspace.upsert({
      where: { teamId: oauth.team.id },
      create: { teamId: oauth.team.id, ...workspaceData },
      update: workspaceData,
    });
    const connData = {
      slackUserId: authedUser.id,
      slackUserName: profile.profile?.display_name || profile.real_name || profile.name || null,
      slackUserAvatar: profile.profile?.image_72 || null,
      slackUserEmail: profile.profile?.email || null,
      userTokenEncrypted: authedUser.access_token ? encrypt(authedUser.access_token) : null,
      userScopes: String(authedUser.scope || '').split(',').filter(Boolean),
    };
    const conn = await tx.slackConnection.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: ws.id } },
      create: { userId: user.id, workspaceId: ws.id, ...connData },
      update: connData,
    });
    return { workspace: ws, connection: conn };
  });

  await auditLogService.create({
    entityId: connection.id,
    entityType: 'SlackConnection',
    action: 'connected',
    actorId: user.id,
    changes: { after: { teamId: workspace.teamId, teamName: workspace.teamName, slackUserId: connection.slackUserId } },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  logger.success(`Slack connected: user ${user.id} → ${workspace.teamName} (${workspace.teamId})`);
  return { workspace, connection };
};

// ── Use / test ───────────────────────────────────────────────────────────────

const findConnection = async (connectionId, userId) => {
  const conn = await prisma.slackConnection.findFirst({
    where: { id: connectionId, ...(userId ? { userId } : {}) },
    include: { workspace: true },
  });
  if (!conn) throwError('Slack connection not found', 404);
  return conn;
};

/**
 * Tokens for one of a user's connections (for features built on top).
 * Returns { userToken, botToken, connection, workspace }.
 */
const getTokens = async (connectionId, userId) => {
  const conn = await findConnection(connectionId, userId);
  return {
    userToken: conn.userTokenEncrypted ? safeDecrypt(conn.userTokenEncrypted, 'user token') : null,
    botToken: safeDecrypt(conn.workspace.botTokenEncrypted, 'bot token'),
    connection: conn,
    workspace: conn.workspace,
  };
};

/** Check both tokens of a connection still work (auth.test). */
const testConnection = async (connectionId, userId) => {
  const { userToken, botToken, workspace } = await getTokens(connectionId, userId);
  const bot = await callSlack('auth.test', { token: botToken });
  const me = userToken ? await callSlack('auth.test', { token: userToken }) : null;
  return {
    ok: true,
    team: bot.team,
    teamId: bot.team_id,
    url: bot.url,
    botName: bot.user,
    you: me ? { id: me.user_id, name: me.user } : null,
    matches: bot.team_id === workspace.teamId,
  };
};

// ── Disconnect ───────────────────────────────────────────────────────────────

/**
 * Remove a connection. Revokes the person's user token; if nobody else in
 * ShokherBoard is connected to that workspace, also revokes the bot token
 * (uninstalling the app there) and deletes the workspace row.
 * `userId` limits it to the caller's own connections (null = admin).
 */
const disconnect = async (connectionId, { userId = null, actorId, meta = {} } = {}) => {
  const conn = await findConnection(connectionId, userId);

  if (conn.userTokenEncrypted) {
    try {
      await callSlack('auth.revoke', { token: decrypt(conn.userTokenEncrypted) });
    } catch (err) {
      logger.warn(`Slack user token revoke failed (removing locally anyway): ${err.message}`);
    }
  }

  await prisma.slackConnection.delete({ where: { id: conn.id } });

  const remaining = await prisma.slackConnection.count({ where: { workspaceId: conn.workspaceId } });
  let workspaceRemoved = false;
  if (remaining === 0) {
    try {
      await callSlack('auth.revoke', { token: decrypt(conn.workspace.botTokenEncrypted) });
    } catch (err) {
      logger.warn(`Slack bot token revoke failed (removing locally anyway): ${err.message}`);
    }
    await prisma.slackWorkspace.delete({ where: { id: conn.workspaceId } }).catch(() => {});
    workspaceRemoved = true;
  }

  await auditLogService.create({
    entityId: conn.id,
    entityType: 'SlackConnection',
    action: 'disconnected',
    actorId,
    changes: { before: { userId: conn.userId, teamId: conn.workspace.teamId, teamName: conn.workspace.teamName } },
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { disconnected: true, teamId: conn.workspace.teamId, workspaceRemoved };
};

/** Where the callback sends the browser afterwards (the user's profile page). */
const portalReturnUrl = (params) => {
  const url = new URL('/profile', config.frontendUrl);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.hash = 'connected-apps';
  return url.toString();
};

module.exports = {
  getMyStatus,
  getAdminOverview,
  getInstallUrl,
  handleCallback,
  getTokens,
  testConnection,
  disconnect,
  callSlack,
  portalReturnUrl,
  DEFAULT_BOT_SCOPES,
  DEFAULT_USER_SCOPES,
};
