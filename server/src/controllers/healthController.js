const prisma = require('../lib/prisma');
const { successResponse } = require('../utils/responseHandler');
const { version } = require('../../package.json');

const getHealth = async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = 'connected';
  } catch {
    dbStatus = 'disconnected';
  }

  return successResponse(res, {
    message: 'Server is running',
    data: {
      version,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbStatus,
      memory: {
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`,
      },
    },
  });
};

module.exports = { getHealth };
