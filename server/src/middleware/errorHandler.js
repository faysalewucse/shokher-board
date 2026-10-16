const { errorResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  const errors = err.errors || null;

  // Prisma Client Validation Error
  if (err.name === 'PrismaClientValidationError') {
    statusCode = 400;
    message = 'Invalid data provided. Please check all required fields and try again.';
  }

  // Prisma Known Request Errors
  if (err.code === 'P2002') {
    statusCode = 409;
    message = 'A record with this information already exists.';
  }
  if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Invalid reference to related data.';
  }
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Record not found.';
  }

  // JWT errors (fallback if not caught in auth middleware)
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  logger.error(`${req.method} ${req.originalUrl} — ${statusCode} — ${message}`);

  return errorResponse(res, {
    statusCode,
    message,
    errors,
    stack: err.stack,
  });
};

module.exports = errorHandler;
