const Joi = require('joi');

module.exports = {
  broadcast: Joi.object({
    title:     Joi.string().trim().min(1).max(100).required(),
    body:      Joi.string().trim().min(1).max(500).required(),
    actionUrl: Joi.string().trim().allow('', null).optional(),
  }),
};
