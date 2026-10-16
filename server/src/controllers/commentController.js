const commentService = require('../services/commentService');
const { boardCtx } = require('../services/boardAccess');
const { successResponse } = require('../utils/responseHandler');

const updateComment = async (req, res, next) => {
  try {
    const data = await commentService.updateComment(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Comment updated successfully', data });
  } catch (error) { next(error); }
};

const deleteComment = async (req, res, next) => {
  try {
    await commentService.deleteComment(req.params.id, boardCtx(req));
    return successResponse(res, { message: 'Comment deleted successfully', data: { id: req.params.id } });
  } catch (error) { next(error); }
};

module.exports = { updateComment, deleteComment };
