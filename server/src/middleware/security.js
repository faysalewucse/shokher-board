const helmet = require('helmet');
const cors = require('cors');

// CORS configuration
// When credentials: true, origin cannot be '*'
const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours
};

// Helmet configuration for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      frameAncestors: ["'self'", 'http://localhost:3000', 'http://localhost:3001'],
    },
  },
  crossOriginEmbedderPolicy: false,
});

module.exports = {
  cors: cors(corsOptions),
  helmet: helmetConfig,
};
