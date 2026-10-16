/**
 * Send a success response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {number} [options.statusCode=200] - HTTP status code
 * @param {string} [options.message='Success'] - Response message
 * @param {*} [options.data=null] - Response data
 * @param {Object} [options.meta=null] - Additional metadata (pagination, etc.)
 */
const successResponse = (res, options = {}) => {
  const {
    statusCode = 200,
    message = 'Success',
    data = null,
    meta = null,
  } = options;

  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
    ...(meta !== null && { meta }),
  };

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {Object} res - Express response object
 * @param {Object} options - Response options
 * @param {number} [options.statusCode=500] - HTTP status code
 * @param {string} [options.message='Internal Server Error'] - Error message
 * @param {Array} [options.errors=null] - Array of error details
 * @param {string} [options.stack=null] - Error stack trace (dev only)
 */
const errorResponse = (res, options = {}) => {
  const {
    statusCode = 500,
    message = 'Internal Server Error',
    errors = null,
    stack = null,
  } = options;

  const response = {
    success: false,
    message,
    ...(errors !== null && { errors }),
    ...(process.env.NODE_ENV === 'development' && stack && { stack }),
  };

  return res.status(statusCode).json(response);
};

/**
 * Throw an error with a status code (caught by errorHandler middleware)
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 */
const throwError = (message, statusCode = 500) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

module.exports = {
  successResponse,
  errorResponse,
  throwError,
};
