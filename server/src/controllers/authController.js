const authService = require('../services/authService');
const { successResponse } = require('../utils/responseHandler');

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);

    return successResponse(res, {
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    await authService.logout(req.user.id);

    return successResponse(res, {
      message: 'Logout successful',
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    // req.body is already validated & sanitized.
    const result = await authService.register(req.body);

    return successResponse(res, {
      statusCode: 201,
      message: 'Registration successful. Please check your email for a 6-digit verification code.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const { status } = await authService.verifyEmail(email, otp);

    return successResponse(res, {
      message:
        status === 'active'
          ? 'Email verified successfully. You can now log in.'
          : 'Email verified. Your account is pending approval.',
      data: { status },
    });
  } catch (error) {
    next(error);
  }
};

const resendVerification = async (req, res, next) => {
  try {
    await authService.resendVerification(req.body.email);

    return successResponse(res, {
      message: 'If that email is registered and unverified, a new OTP has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    await authService.forgotPassword(req.body.email);

    return successResponse(res, {
      message: 'If that email is registered, a password reset OTP has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, password } = req.body;
    await authService.resetPassword(email, otp, password);

    return successResponse(res, {
      message: 'Password reset successful. You can now log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  logout,
  register,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
