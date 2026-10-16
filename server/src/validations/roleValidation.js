const Joi = require('joi');

const permissionKey = Joi.string();

module.exports = {
  createRole: Joi.object({
    name:        Joi.string().min(2).max(50).trim().required(),
    description: Joi.string().max(200).trim().allow('', null).optional(),
    permissions: Joi.array().items(permissionKey).default([]),
    isDefault:   Joi.boolean().default(false),
  }),

  updateRole: Joi.object({
    name:        Joi.string().min(2).max(50).trim().optional(),
    description: Joi.string().max(200).trim().allow('', null).optional(),
    permissions: Joi.array().items(permissionKey).optional(),
    isDefault:   Joi.boolean().optional(),
  }),
};
