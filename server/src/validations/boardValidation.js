const Joi = require('joi');

const BOARD_ROLES = ['owner', 'member', 'viewer'];
const color = Joi.string().max(30).trim();

module.exports = {
  createBoard: Joi.object({
    name:        Joi.string().min(1).max(200).trim().required(),
    description: Joi.string().max(20000).allow('', null).optional(),
    color:       color.allow('', null).optional(),
    projectId:   Joi.string().max(191).allow(null, '').optional(),
  }),

  updateBoard: Joi.object({
    name:        Joi.string().min(1).max(200).trim().optional(),
    description: Joi.string().max(20000).allow('', null).optional(),
    color:       color.allow('', null).optional(),
    projectId:   Joi.string().max(191).allow(null).optional(),
  }).min(1),

  addMember: Joi.object({
    userId: Joi.string().max(191).required(),
    role:   Joi.string().valid(...BOARD_ROLES).default('member'),
  }),

  updateMember: Joi.object({
    role: Joi.string().valid(...BOARD_ROLES).required(),
  }),

  createLabel: Joi.object({
    name:  Joi.string().min(1).max(100).trim().required(),
    color: color.default('blue'),
  }),

  updateLabel: Joi.object({
    name:  Joi.string().min(1).max(100).trim().optional(),
    color: color.optional(),
  }).min(1),

  createList: Joi.object({
    name:     Joi.string().min(1).max(200).trim().required(),
    position: Joi.number().optional(),
  }),

  updateList: Joi.object({
    name:     Joi.string().min(1).max(200).trim().optional(),
    position: Joi.number().optional(),
  }).min(1),

  createMessage: Joi.object({
    text:   Joi.string().min(1).max(20000).trim().required(),
    listId: Joi.string().max(191).allow(null, '').optional(),
  }),
};
