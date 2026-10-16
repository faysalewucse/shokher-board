const roleService = require('../services/roleService');
const { successResponse } = require('../utils/responseHandler');

const getAllRoles = async (req, res, next) => {
  try {
    const result = await roleService.getAllRoles();
    return successResponse(res, { message: 'Roles fetched successfully', data: result.roles });
  } catch (error) { next(error); }
};

const getRoleById = async (req, res, next) => {
  try {
    const result = await roleService.getRoleById(req.params.id);
    return successResponse(res, { message: 'Role fetched successfully', data: result });
  } catch (error) { next(error); }
};

const createRole = async (req, res, next) => {
  try {
    const result = await roleService.createRole(req.body);
    return successResponse(res, { statusCode: 201, message: 'Role created successfully', data: result });
  } catch (error) { next(error); }
};

const updateRole = async (req, res, next) => {
  try {
    const result = await roleService.updateRole(req.params.id, req.body);
    return successResponse(res, { message: 'Role updated successfully', data: result });
  } catch (error) { next(error); }
};

const deleteRole = async (req, res, next) => {
  try {
    await roleService.deleteRole(req.params.id);
    return successResponse(res, { message: 'Role deleted successfully' });
  } catch (error) { next(error); }
};

module.exports = { getAllRoles, getRoleById, createRole, updateRole, deleteRole };
