const prisma = require('../lib/prisma');
const logger = require('../utils/logger');

const connectDB = async () => {
  const start = Date.now();
  try {
    await prisma.$connect();
    logger.success(`PostgreSQL connected via Prisma (${Date.now() - start}ms)`);
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
