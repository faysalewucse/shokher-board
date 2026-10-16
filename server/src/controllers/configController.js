const configService = require('../services/configService');
const { successResponse } = require('../utils/responseHandler');

const getConfig = async (req, res, next) => {
  try {
    const result = await configService.getConfig();
    return successResponse(res, {
      message: 'Config fetched successfully',
      data: result.config,
    });
  } catch (error) {
    next(error);
  }
};

// Public endpoint — only exposes non-sensitive fields
const getPublicConfig = async (req, res, next) => {
  try {
    const { config } = await configService.getConfig();
    return successResponse(res, {
      message: 'Config fetched successfully',
      data: {
        supportEmail: config.supportEmail,
        supportNumbers: config.supportNumbers,
        maintenanceMode: config.maintenanceMode,
        maintenanceMessage: config.maintenanceMessage,
        registrationEnabled: config.registrationEnabled,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateConfig = async (req, res, next) => {
  try {
    const result = await configService.updateConfig(req.body);
    return successResponse(res, {
      message: 'Config updated successfully',
      data: result.config,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getConfig, getPublicConfig, updateConfig };
