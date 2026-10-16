const fs = require('fs').promises;
const path = require('path');
const prisma = require('../lib/prisma');
const logger = require('./logger');
const { UPLOAD_FOLDERS } = require('../config/multer');

// Only folders whose files are tracked in the DB (collected below) are safe to
// scan for orphans — anything else would look orphaned and be deleted. When you
// add a new model with file fields, add its folder here and its references in
// cleanupOrphanedFiles().
// NOTE: UPLOAD_FOLDERS.ATTACHMENTS is intentionally NOT scanned — card
// attachments are kept even when their card is archived. Their URLs are still
// collected below as a safety net should the folder ever be added here.
const ORPHAN_SCAN_FOLDERS = [UPLOAD_FOLDERS.AVATARS];

/**
 * Find and delete orphaned files in the uploads directory
 * Files are considered orphaned if:
 * 1. They exist in the filesystem
 * 2. They are not referenced in the database
 * 3. They are older than the specified age (to handle recent uploads)
 *
 * @param {number} maxAgeHours - Only delete files older than this (default: 24 hours)
 * @returns {Object} Cleanup results
 */
const cleanupOrphanedFiles = async (maxAgeHours = 24) => {
  try {
    const results = {
      deleted: [],
      errors: [],
      totalSize: 0,
      scanned: 0,
    };

    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
    const cutoffTime = Date.now() - maxAge;

    // Collect all referenced file paths from the database
    const referencedFiles = new Set();
    const addRef = (url) => {
      if (url) referencedFiles.add(url.replace(/^\/?uploads\//, ''));
    };

    const users = await prisma.user.findMany({
      where: { avatar: { not: null } },
      select: { avatar: true },
    });
    users.forEach((u) => addRef(u.avatar));

    const attachments = await prisma.attachment.findMany({ select: { url: true } });
    attachments.forEach((a) => addRef(a.url));

    // Scan uploads directory
    const uploadsDir = path.join(__dirname, '../../uploads');

    for (const folder of ORPHAN_SCAN_FOLDERS) {
      const folderPath = path.join(uploadsDir, folder);

      try {
        const files = await fs.readdir(folderPath);

        for (const file of files) {
          results.scanned++;
          const filePath = path.join(folderPath, file);
          const relativePath = `${folder}/${file}`;

          // Skip if referenced in database
          if (referencedFiles.has(relativePath) || referencedFiles.has(`/uploads/${relativePath}`)) {
            continue;
          }

          // Check file age
          const stats = await fs.stat(filePath);

          // Only delete files older than maxAge
          if (stats.mtime.getTime() < cutoffTime) {
            try {
              await fs.unlink(filePath);
              results.deleted.push(relativePath);
              results.totalSize += stats.size;
              logger.info(`Deleted orphaned file: ${relativePath} (${(stats.size / 1024).toFixed(2)} KB)`);
            } catch (error) {
              results.errors.push({ file: relativePath, error: error.message });
              logger.error(`Failed to delete orphaned file: ${relativePath}`, error);
            }
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.error(`Error scanning folder ${folder}:`, error);
        }
      }
    }

    logger.info(`File cleanup completed: ${results.deleted.length} files deleted (${(results.totalSize / 1024 / 1024).toFixed(2)} MB), ${results.errors.length} errors`);

    return results;
  } catch (error) {
    logger.error('Error during file cleanup:', error);
    throw error;
  }
};

/**
 * Clean up files from a specific folder
 * @param {string} folder - Folder name from UPLOAD_FOLDERS
 * @param {number} maxAgeHours - Only delete files older than this
 */
const cleanupFolder = async (folder, maxAgeHours = 24) => {
  try {
    const results = {
      deleted: [],
      errors: [],
      totalSize: 0,
    };

    const maxAge = maxAgeHours * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAge;

    const folderPath = path.join(__dirname, '../../uploads', folder);

    try {
      const files = await fs.readdir(folderPath);

      for (const file of files) {
        const filePath = path.join(folderPath, file);

        // Check file age
        const stats = await fs.stat(filePath);

        // Only delete files older than maxAge
        if (stats.mtime.getTime() < cutoffTime) {
          try {
            await fs.unlink(filePath);
            results.deleted.push(file);
            results.totalSize += stats.size;
            logger.info(`Deleted old file from ${folder}: ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
          } catch (error) {
            results.errors.push({ file, error: error.message });
            logger.error(`Failed to delete file from ${folder}: ${file}`, error);
          }
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(`Error scanning folder ${folder}:`, error);
      }
    }

    return results;
  } catch (error) {
    logger.error(`Error during folder cleanup (${folder}):`, error);
    throw error;
  }
};

/**
 * Get storage usage statistics
 * @returns {Object} Storage stats
 */
const getStorageStats = async () => {
  try {
    const stats = {
      totalSize: 0,
      fileCount: 0,
      folders: {},
    };

    const uploadsDir = path.join(__dirname, '../../uploads');
    const folders = Object.values(UPLOAD_FOLDERS);

    for (const folder of folders) {
      const folderPath = path.join(uploadsDir, folder);
      let folderSize = 0;
      let folderCount = 0;

      try {
        const files = await fs.readdir(folderPath);

        for (const file of files) {
          const filePath = path.join(folderPath, file);
          const fileStats = await fs.stat(filePath);
          folderSize += fileStats.size;
          folderCount++;
        }

        stats.folders[folder] = {
          size: folderSize,
          count: folderCount,
        };
        stats.totalSize += folderSize;
        stats.fileCount += folderCount;
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.error(`Error getting stats for folder ${folder}:`, error);
        }
        stats.folders[folder] = { size: 0, count: 0 };
      }
    }

    return stats;
  } catch (error) {
    logger.error('Error getting storage stats:', error);
    throw error;
  }
};

module.exports = {
  cleanupOrphanedFiles,
  cleanupFolder,
  getStorageStats,
};
