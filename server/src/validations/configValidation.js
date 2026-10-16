const Joi = require('joi');

const phone = Joi.string()
  .trim()
  .pattern(/^[0-9+\-()\s]+$/)
  .messages({ 'string.pattern.base': 'Phone may contain only digits, spaces, +, -, ( and )' });

module.exports = {
  updateConfig: Joi.object({
    supportEmail:        Joi.string().email({ tlds: { allow: false } }).allow('', null).optional(),
    supportNumbers:      Joi.array().items(phone).optional(),
    maintenanceMode:     Joi.boolean().optional(),
    maintenanceMessage:  Joi.string().trim().allow('', null).optional(),
    registrationEnabled: Joi.boolean().optional(),
  }),
};
