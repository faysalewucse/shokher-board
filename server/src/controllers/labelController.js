const boardService = require('../services/boardService');
const { boardCtx } = require('../services/boardAccess');
const { successResponse } = require('../utils/responseHandler');

const updateLabel = async (req, res, next) => {
  try {
    const data = await boardService.updateLabel(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Label updated successfully', data });
  } catch (error) { next(error); }
};

const deleteLabel = async (req, res, next) => {
  try {
    await boardService.deleteLabel(req.params.id, boardCtx(req));
    return successResponse(res, { message: 'Label deleted successfully', data: { id: req.params.id } });
  } catch (error) { next(error); }
};

module.exports = { updateLabel, deleteLabel };
