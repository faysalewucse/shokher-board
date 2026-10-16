const Joi = require('joi');

const email = Joi.string().email({ tlds: { allow: false } }).lowercase().trim().required()
  .messages({ 'string.email': 'Please provide a valid email address' });

const password = Joi.string().min(6).required();

const otp = Joi.string().length(6).pattern(/^\d+$/).required()
  .messages({ 'string.pattern.base': 'OTP must contain digits only' });

module.exports = {
  login: Joi.object({
    email,
    password: Joi.string().required(),
  }),

  register: Joi.object({
    name:  Joi.string().min(2).max(50).trim().required(),
    email,
    password,
    phone: Joi.string().trim().max(20).pattern(/^[0-9+\-()\s]+$/)
      .messages({ 'string.pattern.base': 'Phone may contain only digits, spaces, +, -, ( and )' })
      .allow('', null).optional(),
  }),

  verifyEmail: Joi.object({ email, otp }),

  resendVerification: Joi.object({ email }),

  forgotPassword: Joi.object({ email }),

  resetPassword: Joi.object({ email, otp, password }),
};
