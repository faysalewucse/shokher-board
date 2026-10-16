const checklistService = require('../services/checklistService');
const { boardCtx } = require('../services/boardAccess');
const { successResponse } = require('../utils/responseHandler');

const updateChecklist = async (req, res, next) => {
  try {
    const data = await checklistService.updateChecklist(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Checklist updated successfully', data });
  } catch (error) { next(error); }
};

const deleteChecklist = async (req, res, next) => {
  try {
    await checklistService.deleteChecklist(req.params.id, boardCtx(req));
    return successResponse(res, { message: 'Checklist deleted successfully', data: { id: req.params.id } });
  } catch (error) { next(error); }
};

const createItem = async (req, res, next) => {
  try {
    const data = await checklistService.createItem(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { statusCode: 201, message: 'Checklist item created successfully', data });
  } catch (error) { next(error); }
};

const updateItem = async (req, res, next) => {
  try {
    const data = await checklistService.updateItem(req.params.id, req.body, boardCtx(req));
    return successResponse(res, { message: 'Checklist item updated successfully', data });
  } catch (error) { next(error); }
};

const deleteItem = async (req, res, next) => {
  try {
    await checklistService.deleteItem(req.params.id, boardCtx(req));
    return successResponse(res, { message: 'Checklist item deleted successfully', data: { id: req.params.id } });
  } catch (error) { next(error); }
};

module.exports = { updateChecklist, deleteChecklist, createItem, updateItem, deleteItem };
