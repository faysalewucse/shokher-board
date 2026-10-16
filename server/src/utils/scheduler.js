const cron = require('node-cron');
const logger = require('./logger');
const { cleanupOrphanedFiles } = require('./fileCleanup');
const notificationService = require('../services/notificationService');
const { runDueSoonCheck } = require('../services/dueSoonService');

/**
 * Scheduled job manager
 */
class Scheduler {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Schedule a cleanup job to run daily
   * @param {string} cronExpression - Cron expression (default: daily at 2 AM)
   * @param {number} maxAgeHours - Files older than this will be cleaned up
   */
  scheduleCleanup(cronExpression = '0 2 * * *', maxAgeHours = 24) {
    const jobName = 'file-cleanup';

    if (this.jobs.has(jobName)) {
      logger.warn('File cleanup job already scheduled');
      return;
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        logger.info('Running scheduled file cleanup...');
        const results = await cleanupOrphanedFiles(maxAgeHours);

        if (results.deleted.length > 0) {
          logger.info(`Cleanup completed: ${results.deleted.length} files freed ${(results.totalSize / 1024 / 1024).toFixed(2)} MB`);
        } else {
          logger.info('Cleanup completed: No orphaned files found');
        }

        if (results.errors.length > 0) {
          logger.warn(`Cleanup encountered ${results.errors.length} errors`);
        }
      } catch (error) {
        logger.error('Scheduled cleanup failed:', error);
      }
    });

    this.jobs.set(jobName, job);
    logger.info(`Scheduled file cleanup job: ${cronExpression}`);
  }

  /**
   * Schedule a notification cleanup job to run weekly
   * @param {string} cronExpression - Cron expression (default: weekly on Sunday at 3 AM)
   * @param {number} days - Delete notifications older than this many days
   */
  scheduleNotificationCleanup(cronExpression = '0 3 * * 0', days = 90) {
    const jobName = 'notification-cleanup';

    if (this.jobs.has(jobName)) {
      logger.warn('Notification cleanup job already scheduled');
      return;
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        logger.info('Running scheduled notification cleanup...');
        const result = await notificationService.cleanupOldNotifications(days);
        logger.info(`Notification cleanup completed: ${result.deletedCount} notifications deleted`);
      } catch (error) {
        logger.error('Scheduled notification cleanup failed:', error);
      }
    });

    this.jobs.set(jobName, job);
    logger.info(`Scheduled notification cleanup job: ${cronExpression} (deleting older than ${days} days)`);
  }

  /**
   * Schedule the card due-soon notifier (hourly by default): notifies assignees
   * of cards due within 24h that aren't completed and haven't been notified.
   * @param {string} cronExpression - Cron expression (default: every hour, on the hour)
   */
  scheduleDueSoon(cronExpression = '0 * * * *') {
    const jobName = 'card-due-soon';

    if (this.jobs.has(jobName)) {
      logger.warn('Card due-soon job already scheduled');
      return;
    }

    const job = cron.schedule(cronExpression, async () => {
      try {
        await runDueSoonCheck(24);
      } catch (error) {
        logger.error(`Card due-soon job failed: ${error.message}`);
      }
    });

    this.jobs.set(jobName, job);
    logger.info(`Scheduled card due-soon job: ${cronExpression}`);
  }

  /**
   * Stop all scheduled jobs
   */
  stopAll() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    });
    this.jobs.clear();
  }

  /**
   * Stop a specific job
   * @param {string} jobName - Name of the job to stop
   */
  stop(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      this.jobs.delete(jobName);
      logger.info(`Stopped job: ${jobName}`);
    }
  }
}

// Create singleton instance
const scheduler = new Scheduler();

module.exports = scheduler;
