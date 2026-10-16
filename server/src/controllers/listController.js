const boardService = require('../services/boardService');
const { boardCtx } = require('../services/boardAccess');
const { successResponse } = require('../utils/responseHandler');

const updateList = async (req, res, next) => {
  try {
    const data = await boardService.updateList(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'List updated successfully', data });
  } catch (error) { next(error); }
};

const archiveList = async (req, res, next) => {
  try {
    await boardService.archiveList(req.params.id, boardCtx(req));
    return successResponse(res, { message: 'List archived successfully', data: { id: req.params.id } });
  } catch (error) { next(error); }
};

module.exports = { updateList, archiveList };
