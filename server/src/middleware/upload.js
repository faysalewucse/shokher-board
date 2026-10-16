const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const {
  createImageUploader,
  createFileUploader,
  createCloudUploader,
  createAttachmentUploader,
  UPLOAD_FOLDERS,
  FILE_SIZE_LIMITS,
} = require('../config/multer');

// Error handler wrapper - returns error object instead of sending response
const handleUploadError = (err) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return { message: 'File size too large', statusCode: 400 };
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return { message: 'Unexpected field name for file upload', statusCode: 400 };
    }
    return { message: err.message || 'File upload error', statusCode: 400 };
  }
  return null;
};

/**
 * Upload single image
 * @param {string} fieldName - Form field name
 * @param {string} folder - Upload folder (avatars, documents)
 * @param {number} maxSize - Max file size in bytes (optional)
 */
const uploadImage = (fieldName, folder = UPLOAD_FOLDERS.DOCUMENTS, maxSize = FILE_SIZE_LIMITS.image) => {
  const uploader = createImageUploader(folder, maxSize);
  return (req, res, next) => {
    uploader.single(fieldName)(req, res, (err) => {
      const error = handleUploadError(err);
      if (error) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      next();
    });
  };
};

/**
 * Upload multiple images
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Maximum number of files
 * @param {string} folder - Upload folder
 * @param {number} maxSize - Max file size in bytes (optional)
 */
const uploadImages = (fieldName, maxCount = 5, folder = UPLOAD_FOLDERS.DOCUMENTS, maxSize = FILE_SIZE_LIMITS.image) => {
  const uploader = createImageUploader(folder, maxSize);
  return (req, res, next) => {
    uploader.array(fieldName, maxCount)(req, res, (err) => {
      const error = handleUploadError(err);
      if (error) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      next();
    });
  };
};

/**
 * Upload single file (images + documents)
 * @param {string} fieldName - Form field name
 * @param {string} folder - Upload folder
 * @param {number} maxSize - Max file size in bytes (optional)
 */
const uploadFile = (fieldName, folder = UPLOAD_FOLDERS.DOCUMENTS, maxSize = FILE_SIZE_LIMITS.file) => {
  const uploader = createFileUploader(folder, maxSize);
  return (req, res, next) => {
    uploader.single(fieldName)(req, res, (err) => {
      const error = handleUploadError(err);
      if (error) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      next();
    });
  };
};

/**
 * Upload multiple files
 * @param {string} fieldName - Form field name
 * @param {number} maxCount - Maximum number of files
 * @param {string} folder - Upload folder
 * @param {number} maxSize - Max file size in bytes (optional)
 */
const uploadFiles = (fieldName, maxCount = 5, folder = UPLOAD_FOLDERS.DOCUMENTS, maxSize = FILE_SIZE_LIMITS.file) => {
  const uploader = createFileUploader(folder, maxSize);
  return (req, res, next) => {
    uploader.array(fieldName, maxCount)(req, res, (err) => {
      const error = handleUploadError(err);
      if (error) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      next();
    });
  };
};

/**
 * Upload a single card attachment (any non-executable type, 20MB) to uploads/attachments/
 * @param {string} fieldName - Form field name (default "file")
 */
const uploadAttachment = (fieldName = 'file') => {
  const uploader = createAttachmentUploader();
  return (req, res, next) => {
    uploader.single(fieldName)(req, res, (err) => {
      const error = handleUploadError(err);
      if (error) {
        return res.status(error.statusCode).json({
          success: false,
          message: err.code === 'LIMIT_FILE_SIZE' ? 'File size too large (max 20MB)' : error.message,
        });
      }
      next();
    });
  };
};

/**
 * Upload to memory (for cloud storage like S3, Cloudinary)
 * @param {string} fieldName - Form field name
 * @param {string} type - 'image' or 'file'
 * @param {number} maxSize - Max file size in bytes
 */
const uploadToMemory = (fieldName, type = 'image', maxSize = FILE_SIZE_LIMITS.image) => {
  const uploader = createCloudUploader(type, maxSize);
  return (req, res, next) => {
    uploader.single(fieldName)(req, res, (err) => {
      const error = handleUploadError(err);
      if (error) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      next();
    });
  };
};

/**
 * Build a relative URL for an uploaded file. The host is intentionally omitted
 * so values stay portable across environments (local/staging/production). The
 * frontend prepends its API host when rendering.
 * @param {Object} _req - Express request object (unused; kept for backwards compat)
 * @param {string} filename - File name
 * @param {string} folder - Upload folder
 */
const getFileUrl = (_req, filename, folder) => {
  return `/uploads/${folder}/${filename}`;
};

/**
 * Delete file from disk
 * @param {string} filepath - Full file path or relative path from uploads
 */
const deleteFile = async (filepath) => {
  try {
    const fullPath = filepath.startsWith('/')
      ? filepath
      : path.join(__dirname, '../../uploads', filepath);
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    logger.error(`Error deleting file: ${error.message}`);
    return false;
  }
};

/**
 * Delete file by URL
 * @param {string} fileUrl - Full URL of the file
 */
const deleteFileByUrl = async (fileUrl) => {
  try {
    // Accept either a relative path (/uploads/folder/file) or a legacy
    // absolute URL (http://host/uploads/folder/file).
    const pathname = /^https?:\/\//.test(fileUrl)
      ? new URL(fileUrl).pathname
      : fileUrl;
    const relativePath = pathname.replace(/^\/?uploads\//, '');
    return deleteFile(relativePath);
  } catch (error) {
    logger.error(`Error deleting file by URL: ${error.message}`);
    return false;
  }
};

module.exports = {
  uploadImage,
  uploadImages,
  uploadFile,
  uploadFiles,
  uploadToMemory,
  uploadAttachment,
  getFileUrl,
  deleteFile,
  deleteFileByUrl,
  UPLOAD_FOLDERS,
};
