const express = require('express');
const {
  login,
  logout,
  register,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const {
  loginLimiter,
  registerLimiter,
  verifyEmailLimiter,
  resendVerificationLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
} = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const authValidation = require('../validations/authValidation');

const router = express.Router();

router.post('/login',               loginLimiter,               validate(authValidation.login),               login);
router.post('/logout',              authenticate,               logout);
router.post('/register',            registerLimiter,            validate(authValidation.register),            register);
router.post('/verify-email',        verifyEmailLimiter,         validate(authValidation.verifyEmail),         verifyEmail);
router.post('/resend-verification', resendVerificationLimiter,  validate(authValidation.resendVerification),  resendVerification);
router.post('/forgot-password',     forgotPasswordLimiter,      validate(authValidation.forgotPassword),      forgotPassword);
router.post('/reset-password',      resetPasswordLimiter,       validate(authValidation.resetPassword),       resetPassword);

module.exports = router;
