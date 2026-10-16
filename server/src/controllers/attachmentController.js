const attachmentService = require('../services/attachmentService');
const { boardCtx } = require('../services/boardAccess');
const { successResponse } = require('../utils/responseHandler');

const deleteAttachment = async (req, res, next) => {
  try {
    await attachmentService.deleteAttachment(req.params.id, boardCtx(req));
    return successResponse(res, { message: 'Attachment deleted successfully', data: { id: req.params.id } });
  } catch (error) { next(error); }
};

module.exports = { deleteAttachment };
