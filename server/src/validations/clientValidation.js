const Joi = require('joi');

const optText = (max) => Joi.string().max(max).trim().allow('', null).optional();

module.exports = {
  createClient: Joi.object({
    name:    Joi.string().min(1).max(200).trim().required(),
    company: optText(200),
    email:   Joi.string().email({ tlds: { allow: false } }).max(255).trim().lowercase().allow('', null).optional(),
    phone:   optText(50),
    notes:   optText(10000),
  }),

  updateClient: Joi.object({
    name:    Joi.string().min(1).max(200).trim().optional(),
    company: optText(200),
    email:   Joi.string().email({ tlds: { allow: false } }).max(255).trim().lowercase().allow('', null).optional(),
    phone:   optText(50),
    notes:   optText(10000),
  }).min(1),
};
