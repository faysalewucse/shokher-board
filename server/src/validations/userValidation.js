const Joi = require('joi');
const { ACCOUNT_STATUS, getValues } = require('../constants/enums');

const phone = Joi.string().trim().max(20).pattern(/^[0-9+\-()\s]+$/).allow('', null).optional()
  .messages({ 'string.pattern.base': 'Phone may contain only digits, spaces, +, -, ( and )' });

const status = Joi.string().valid(...getValues(ACCOUNT_STATUS)).optional();

module.exports = {
  createUser: Joi.object({
    name:     Joi.string().min(2).max(50).trim().required(),
    email:    Joi.string().email({ tlds: { allow: false } }).lowercase().trim().required(),
    password: Joi.string().min(6).required(),
    phone,
    role:     Joi.string().trim().allow(null).optional(),
    status,
  }),

  updateUser: Joi.object({
    name:   Joi.string().min(2).max(50).trim().optional(),
    phone,
    status,
    role:   Joi.string().trim().allow(null).optional(),
  }),

  updateMe: Joi.object({
    name:  Joi.string().min(2).max(50).trim().optional(),
    phone,
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword:     Joi.string().min(6).required(),
  }),

  assignRole: Joi.object({
    roleId: Joi.string().trim().allow(null).required(),
  }),

  sendNotification: Joi.object({
    title:     Joi.string().trim().min(1).max(100).required(),
    body:      Joi.string().trim().min(1).max(500).required(),
    actionUrl: Joi.string().trim().allow('', null).optional(),
  }),
};
