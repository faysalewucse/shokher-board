require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';

// Fail fast in production instead of falling back to a well-known default — a
// hardcoded JWT secret (or DB URL) would be a critical vulnerability: anyone
// could forge valid tokens and impersonate any user. Dev keeps a convenience
// default so local setup stays zero-config.
const required = (name, devDefault) => {
  const value = process.env[name];
  if (value) return value;
  if (isProd) {
    throw new Error(`Missing required environment variable ${name} — refusing to start in production with an insecure default.`);
  }
  return devDefault;
};

module.exports = {
  port:        process.env.PORT       || 8000,
  nodeEnv,
  apiPrefix:   process.env.API_PREFIX || '/api/v1',
  databaseUrl: required('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/single_project'),
  jwt: {
    secret:    required('JWT_SECRET', 'dev-only-insecure-secret-do-not-use-in-prod'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
