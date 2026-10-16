const clientService = require('../services/clientService');
const { successResponse } = require('../utils/responseHandler');

const listClients = async (req, res, next) => {
  try {
    const data = await clientService.listClients(req.query);
    return successResponse(res, { message: 'Clients fetched successfully', data });
  } catch (error) { next(error); }
};

const getClient = async (req, res, next) => {
  try {
    const data = await clientService.getClient(req.params.id);
    return successResponse(res, { message: 'Client fetched successfully', data });
  } catch (error) { next(error); }
};

const createClient = async (req, res, next) => {
  try {
    const data = await clientService.createClient(req.body, req.user.id);
    return successResponse(res, { statusCode: 201, message: 'Client created successfully', data });
  } catch (error) { next(error); }
};

const updateClient = async (req, res, next) => {
  try {
    const data = await clientService.updateClient(req.params.id, req.body);
    return successResponse(res, { message: 'Client updated successfully', data });
  } catch (error) { next(error); }
};

const archiveClient = async (req, res, next) => {
  try {
    const data = await clientService.archiveClient(req.params.id);
    return successResponse(res, { message: 'Client archived successfully', data });
  } catch (error) { next(error); }
};

module.exports = { listClients, getClient, createClient, updateClient, archiveClient };
