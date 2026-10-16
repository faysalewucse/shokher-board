const cardService = require('../services/cardService');
const checklistService = require('../services/checklistService');
const commentService = require('../services/commentService');
const attachmentService = require('../services/attachmentService');
const { boardCtx } = require('../services/boardAccess');
const { successResponse } = require('../utils/responseHandler');

const getCard = async (req, res, next) => {
  try {
    const data = await cardService.getCard(req.params.id);
    return successResponse(res, { message: 'Card fetched successfully', data });
  } catch (error) { next(error); }
};

const updateCard = async (req, res, next) => {
  try {
    const data = await cardService.updateCard(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Card updated successfully', data });
  } catch (error) { next(error); }
};

const moveCard = async (req, res, next) => {
  try {
    const data = await cardService.moveCard(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Card moved successfully', data });
  } catch (error) { next(error); }
};

const archiveCard = async (req, res, next) => {
  try {
    await cardService.archiveCard(req.params.id, boardCtx(req));
    return successResponse(res, { message: 'Card archived successfully', data: { id: req.params.id } });
  } catch (error) { next(error); }
};

const setAssignees = async (req, res, next) => {
  try {
    const data = await cardService.setAssignees(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Assignees updated successfully', data });
  } catch (error) { next(error); }
};

const setLabels = async (req, res, next) => {
  try {
    const data = await cardService.setLabels(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Labels updated successfully', data });
  } catch (error) { next(error); }
};

const listActivity = async (req, res, next) => {
  try {
    const { items, nextCursor } = await cardService.listCardActivity(req.params.id, req.query);
    return successResponse(res, { message: 'Activity fetched successfully', data: items, meta: { nextCursor } });
  } catch (error) { next(error); }
};

const createChecklist = async (req, res, next) => {
  try {
    const data = await checklistService.createChecklist(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'Checklist created successfully', data });
  } catch (error) { next(error); }
};

const listComments = async (req, res, next) => {
  try {
    const data = await commentService.listComments(req.params.id);
    return successResponse(res, { message: 'Comments fetched successfully', data });
  } catch (error) { next(error); }
};

const createComment = async (req, res, next) => {
  try {
    const data = await commentService.createComment(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'Comment added successfully', data });
  } catch (error) { next(error); }
};

const addAttachment = async (req, res, next) => {
  try {
    const data = await attachmentService.addAttachment(req.params.id, req.file, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'Attachment uploaded successfully', data });
  } catch (error) { next(error); }
};

module.exports = {
  getCard, updateCard, moveCard, archiveCard, setAssignees, setLabels, listActivity,
  createChecklist, listComments, createComment, addAttachment,
};
