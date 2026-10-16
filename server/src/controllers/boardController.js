const boardService = require('../services/boardService');
const cardService = require('../services/cardService');
const { boardCtx } = require('../services/boardAccess');
const { successResponse } = require('../utils/responseHandler');

// ── Boards ──────────────────────────────────────────────────

const listBoards = async (req, res, next) => {
  try {
    const data = await boardService.listBoards(req.query, { userId: req.user.id, permissions: req.permissions });
    return successResponse(res, { message: 'Boards fetched successfully', data });
  } catch (error) { next(error); }
};

const createBoard = async (req, res, next) => {
  try {
    const data = await boardService.createBoard(req.body, { userId: req.user.id });
    return successResponse(res, { statusCode: 201, message: 'Board created successfully', data });
  } catch (error) { next(error); }
};

const getBoard = async (req, res, next) => {
  try {
    const data = await boardService.getBoard(req.board.id, boardCtx(req));
    return successResponse(res, { message: 'Board fetched successfully', data });
  } catch (error) { next(error); }
};

const updateBoard = async (req, res, next) => {
  try {
    const data = await boardService.updateBoard(req.board.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Board updated successfully', data });
  } catch (error) { next(error); }
};

const archiveBoard = async (req, res, next) => {
  try {
    await boardService.archiveBoard(req.board.id, boardCtx(req));
    return successResponse(res, { message: 'Board archived successfully', data: { id: req.board.id } });
  } catch (error) { next(error); }
};

// ── Members ─────────────────────────────────────────────────

const addMember = async (req, res, next) => {
  try {
    const data = await boardService.addMember(req.board.id, req.body, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'Member added successfully', data });
  } catch (error) { next(error); }
};

const updateMember = async (req, res, next) => {
  try {
    const data = await boardService.updateMember(req.board.id, req.params.userId, req.body, boardCtx(req));
    return successResponse(res, { message: 'Member updated successfully', data });
  } catch (error) { next(error); }
};

const removeMember = async (req, res, next) => {
  try {
    await boardService.removeMember(req.board.id, req.params.userId, boardCtx(req));
    return successResponse(res, { message: 'Member removed successfully' });
  } catch (error) { next(error); }
};

// ── Labels ──────────────────────────────────────────────────

const createLabel = async (req, res, next) => {
  try {
    const data = await boardService.createLabel(req.board.id, req.body, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'Label created successfully', data });
  } catch (error) { next(error); }
};

// ── Activity ────────────────────────────────────────────────

const listActivity = async (req, res, next) => {
  try {
    const { items, nextCursor } = await boardService.listBoardActivity(req.board.id, req.query);
    return successResponse(res, { message: 'Activity fetched successfully', data: items, meta: { nextCursor } });
  } catch (error) { next(error); }
};

// ── Lists & cards on a board ────────────────────────────────

const createList = async (req, res, next) => {
  try {
    const data = await boardService.createList(req.board.id, req.body, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'List created successfully', data });
  } catch (error) { next(error); }
};

const createCard = async (req, res, next) => {
  try {
    const data = await cardService.createCard(req.board.id, req.body, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'Card created successfully', data });
  } catch (error) { next(error); }
};

// ── Messages ────────────────────────────────────────────────

const listMessages = async (req, res, next) => {
  try {
    const { items, nextCursor } = await cardService.listMessages(req.board.id, req.query);
    return successResponse(res, { message: 'Messages fetched successfully', data: items, meta: { nextCursor } });
  } catch (error) { next(error); }
};

const createMessage = async (req, res, next) => {
  try {
    const data = await cardService.createMessage(req.board.id, req.body, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'Message created successfully', data });
  } catch (error) { next(error); }
};

module.exports = {
  listBoards, createBoard, getBoard, updateBoard, archiveBoard,
  addMember, updateMember, removeMember,
  createLabel, listActivity, createList, createCard, listMessages, createMessage,
};
