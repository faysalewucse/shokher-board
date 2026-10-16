const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { decodePermissions } = require('../constants/permissions');

let io = null;

const userRoom = (userId) => `user:${userId}`;
const boardRoom = (boardId) => `board:${boardId}`;

/**
 * Extracts a JWT from the socket handshake. Supports:
 *   - socket.handshake.auth.token   (preferred, used by socket.io clients)
 *   - Authorization: Bearer <token> header
 *   - ?token=<token> query string
 */
const extractToken = (socket) => {
  const auth = socket.handshake?.auth?.token;
  if (auth) return auth;

  const header = socket.handshake?.headers?.authorization;
  if (header && header.startsWith('Bearer ')) return header.substring(7);

  const query = socket.handshake?.query?.token;
  if (query) return query;

  return null;
};

const authMiddleware = (socket, next) => {
  try {
    const token = extractToken(socket);
    if (!token) return next(new Error('Authentication required'));

    const decoded = jwt.verify(token, config.jwt.secret);
    socket.user = { id: decoded.id, role: decoded.role };
    socket.permissions = decoded.p ? decodePermissions(decoded.p) : [];
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return next(new Error('Token expired'));
    return next(new Error('Invalid token'));
  }
};

const initSocket = (httpServer) => {
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use(authMiddleware);

  io.on('connection', (socket) => {
    const userId = socket.user?.id;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.join(userRoom(userId));
    logger.info(`Socket connected: ${socket.id} (user ${userId})`);

    // Boards realtime: clients join `board:<id>` rooms after a membership check.
    socket.on('board:join', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const boardId = payload?.boardId;
        if (!boardId || typeof boardId !== 'string') return reply({ ok: false, error: 'boardId is required' });
        // Lazy require: boardAccess → prisma; keeps this module light for callers.
        const { getBoardRole } = require('../services/boardAccess');
        const role = await getBoardRole(userId, boardId, socket.permissions);
        if (!role) return reply({ ok: false, error: 'Not a member of this board' });
        socket.join(boardRoom(boardId));
        return reply({ ok: true });
      } catch (err) {
        logger.error(`board:join failed: ${err.message}`);
        return reply({ ok: false, error: 'Could not join board' });
      }
    });

    socket.on('board:leave', (payload, ack) => {
      const boardId = payload?.boardId;
      if (boardId) socket.leave(boardRoom(boardId));
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (user ${userId}) — ${reason}`);
    });
  });

  return io;
};

const getIO = () => io;

/**
 * Emit an event to every socket connected for a given user.
 * Safe to call before initSocket — it becomes a no-op.
 */
const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit(event, payload);
};

/**
 * Broadcast to every connected socket. Use sparingly.
 */
const emitToAll = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

/**
 * Broadcast a board mutation to everyone viewing the board.
 * Emits `board:event { boardId, type, payload, actorId }` to room `board:<id>`.
 */
const emitToBoard = (boardId, type, payload, actorId = null) => {
  if (!io || !boardId) return;
  io.to(boardRoom(boardId)).emit('board:event', { boardId, type, payload, actorId });
};

/**
 * Remove every socket of a user from a board room (e.g. after removal from the board).
 */
const removeUserFromBoardRoom = (userId, boardId) => {
  if (!io || !userId || !boardId) return;
  io.in(userRoom(userId)).socketsLeave(boardRoom(boardId));
};

module.exports = {
  initSocket,
  emitToBoard,
  removeUserFromBoardRoom,
  boardRoom,
  getIO,
  emitToUser,
  emitToAll,
  userRoom,
};
