const jwt = require('jsonwebtoken');
const config = require('../config');
const { throwError } = require('../utils/responseHandler');
const { decodePermissions } = require('../constants/permissions');

/**
 * Authenticate — verifies JWT and decodes permissions.
 */
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throwError('Authentication required', 401);

    const token = header.substring(7);
    if (!token) throwError('Authentication required', 401);

    const decoded = jwt.verify(token, config.jwt.secret);

    req.user        = { id: decoded.id, role: decoded.role };
    req.permissions = decoded.p ? decodePermissions(decoded.p) : [];

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') return next(Object.assign(new Error('Invalid token'), { statusCode: 401 }));
    if (error.name === 'TokenExpiredError')  return next(Object.assign(new Error('Token expired'),  { statusCode: 401 }));
    next(error);
  }
};

/**
 * Authorize — checks if the user has the required permission(s).
 * Usage: router.get('/users', authenticate, authorize('USER_READ_ANY'), handler)
 */
const authorize = (...requiredPermissions) => {
  return (req, res, next) => {
    const hasAccess = requiredPermissions.every((p) => (req.permissions || []).includes(p));
    if (!hasAccess) {
      return next(Object.assign(new Error('You do not have permission to perform this action'), { statusCode: 403 }));
    }
    next();
  };
};

/**
 * Authorize ANY — passes if user has at least one of the listed permissions.
 * Usage: router.patch('/x', authenticate, authorizeAny('SETTINGS_UPDATE', 'ANALYTICS_SETTINGS_UPDATE'), handler)
 */
const authorizeAny = (...allowedPermissions) => {
  return (req, res, next) => {
    const hasAccess = allowedPermissions.some((p) => (req.permissions || []).includes(p));
    if (!hasAccess) {
      return next(Object.assign(new Error('You do not have permission to perform this action'), { statusCode: 403 }));
    }
    next();
  };
};

/**
 * Optional Authenticate — verifies JWT if present, but doesn't require it.
 * Useful for public endpoints that can provide personalized data for authenticated users.
 */
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(); // No token, continue without user
    }

    const token = header.substring(7);
    if (!token) return next(); // No token, continue without user

    const decoded = jwt.verify(token, config.jwt.secret);
    req.user        = { id: decoded.id, role: decoded.role };
    req.permissions = decoded.p ? decodePermissions(decoded.p) : [];
    next();
  } catch (error) {
    // Ignore auth errors for optional auth - continue without user
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next();
    }
    next(error);
  }
};

module.exports = { authenticate, authorize, authorizeAny, optionalAuth };
