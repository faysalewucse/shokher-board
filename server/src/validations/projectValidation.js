const Joi = require('joi');

const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'done'];

module.exports = {
  PROJECT_STATUSES,

  createProject: Joi.object({
    name:        Joi.string().min(1).max(200).trim().required(),
    description: Joi.string().max(20000).allow('', null).optional(),
    clientId:    Joi.string().max(191).allow(null).optional(),
    status:      Joi.string().valid(...PROJECT_STATUSES).default('planning'),
    startDate:   Joi.date().allow(null).optional(),
    deadline:    Joi.date().allow(null).optional(),
    ownerId:     Joi.string().max(191).allow(null).optional(),
  }),

  updateProject: Joi.object({
    name:        Joi.string().min(1).max(200).trim().optional(),
    description: Joi.string().max(20000).allow('', null).optional(),
    clientId:    Joi.string().max(191).allow(null).optional(),
    status:      Joi.string().valid(...PROJECT_STATUSES).optional(),
    startDate:   Joi.date().allow(null).optional(),
    deadline:    Joi.date().allow(null).optional(),
    ownerId:     Joi.string().max(191).allow(null).optional(),
  }).min(1),
};
