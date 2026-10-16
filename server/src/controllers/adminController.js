const { cleanupOrphanedFiles, getStorageStats } = require('../utils/fileCleanup');
const { successResponse } = require('../utils/responseHandler');
const logger = require('../utils/logger');

/**
 * Trigger manual cleanup of orphaned files
 */
const triggerCleanup = async (req, res, next) => {
  try {
    const maxAgeHours = parseInt(req.query.maxAge) || 24;

    logger.info(`Manual cleanup triggered by user ${req.user.id}`);

    const results = await cleanupOrphanedFiles(maxAgeHours);

    return successResponse(res, {
      message: 'File cleanup completed successfully',
      data: {
        deleted: results.deleted.length,
        errors: results.errors.length,
        totalSize: results.totalSize,
        totalSizeMB: (results.totalSize / 1024 / 1024).toFixed(2),
        scanned: results.scanned,
        files: results.deleted,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get storage statistics
 */
const getStorageInfo = async (req, res, next) => {
  try {
    const stats = await getStorageStats();

    return successResponse(res, {
      message: 'Storage statistics retrieved successfully',
      data: {
        totalSize: stats.totalSize,
        totalSizeMB: (stats.totalSize / 1024 / 1024).toFixed(2),
        totalSizeGB: (stats.totalSize / 1024 / 1024 / 1024).toFixed(2),
        fileCount: stats.fileCount,
        folders: Object.entries(stats.folders).map(([name, info]) => ({
          name,
          size: info.size,
          sizeMB: (info.size / 1024 / 1024).toFixed(2),
          count: info.count,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  triggerCleanup,
  getStorageInfo,
};
