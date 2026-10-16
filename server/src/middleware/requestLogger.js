const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    logger.http(req.method, req.originalUrl, res.statusCode, Date.now() - start);
  });

  next();
};

module.exports = requestLogger;
