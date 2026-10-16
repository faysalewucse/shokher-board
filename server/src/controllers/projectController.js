const projectService = require('../services/projectService');
const { successResponse } = require('../utils/responseHandler');

const listProjects = async (req, res, next) => {
  try {
    const data = await projectService.listProjects(req.query);
    return successResponse(res, { message: 'Projects fetched successfully', data });
  } catch (error) { next(error); }
};

const getProject = async (req, res, next) => {
  try {
    const data = await projectService.getProject(req.params.id, { userId: req.user.id, permissions: req.permissions });
    return successResponse(res, { message: 'Project fetched successfully', data });
  } catch (error) { next(error); }
};

const createProject = async (req, res, next) => {
  try {
    const data = await projectService.createProject(req.body, req.user.id);
    return successResponse(res, { statusCode: 201, message: 'Project created successfully', data });
  } catch (error) { next(error); }
};

const updateProject = async (req, res, next) => {
  try {
    const data = await projectService.updateProject(req.params.id, req.body, req.user.id);
    return successResponse(res, { message: 'Project updated successfully', data });
  } catch (error) { next(error); }
};

const archiveProject = async (req, res, next) => {
  try {
    const data = await projectService.archiveProject(req.params.id);
    return successResponse(res, { message: 'Project archived successfully', data });
  } catch (error) { next(error); }
};

module.exports = { listProjects, getProject, createProject, updateProject, archiveProject };
