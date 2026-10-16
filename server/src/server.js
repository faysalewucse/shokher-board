const http = require('http');
const app = require('./app');
const config = require('./config');
const connectDB = require('./config/database');
const prisma = require('./lib/prisma');
const logger = require('./utils/logger');
const { initSocket } = require('./lib/socket');
const scheduler = require('./utils/scheduler');

const startServer = async () => {
  const bootStart = Date.now();
  const elapsed = () => {
    const ms = Date.now() - bootStart;
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
  };

  // Everything before this point was the module-load phase: require('./app')
  // pulls in Express, every route/controller/service, and the Prisma client —
  // usually the biggest chunk of a cold start. process.uptime() measures it.
  logger.info(`Modules loaded (${process.uptime().toFixed(1)}s) — booting…`);

  logger.info('Connecting to database…');
  await connectDB();

  // Schedule file cleanup job - runs daily at 3:00 AM
  // Only run in production to avoid cleaning up during development
  if (config.nodeEnv === 'production') {
    scheduler.scheduleCleanup('0 3 * * *', 24); // Cleanup files older than 24 hours
    logger.info('Scheduled file cleanup job: Daily at 3:00 AM');

    // Schedule notification cleanup job - runs weekly on Sunday at 3:00 AM
    scheduler.scheduleNotificationCleanup('0 3 * * 0', 90); // Cleanup notifications older than 90 days
    logger.info('Scheduled notification cleanup job: Weekly on Sunday at 3:00 AM');
  }

  // Card due-soon notifications — hourly, in every environment
  scheduler.scheduleDueSoon('0 * * * *');

  logger.info('Initializing realtime (Socket.IO)…');
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  const server = httpServer.listen(config.port, () => {
    logger.success(`Server ready in ${elapsed()}`);
    logger.banner(config.port, config.nodeEnv);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.warn(`${signal} received — shutting down gracefully`);
    scheduler.stopAll();
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled errors
  process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`);
    server.close(() => process.exit(1));
  });

  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`);
    process.exit(1);
  });
};

startServer().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
