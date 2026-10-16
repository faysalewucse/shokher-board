const fs = require('fs');
const { validate } = require('./validate');

/**
 * Upload and validate with automatic cleanup on validation failure
 * Use this AFTER multer upload middleware to clean up files if validation fails
 */
const validateWithCleanup = (validationSchema) => {
  return (req, res, next) => {
    // Track uploaded files for potential cleanup
    const uploadedFiles = [];

    if (req.files) {
      Object.keys(req.files).forEach(field => {
        const files = req.files[field];
        if (Array.isArray(files)) {
          files.forEach(file => {
            if (file && file.path) uploadedFiles.push(file.path);
          });
        } else if (files && files.path) {
          uploadedFiles.push(files.path);
        }
      });
    }

    // Cleanup function
    const cleanup = () => {
      uploadedFiles.forEach(filePath => {
        if (filePath && fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log('Cleaned up uploaded file:', filePath);
          } catch (err) {
            console.error('Failed to cleanup file:', filePath, err);
          }
        }
      });
    };

    // Store cleanup function on request
    req.cleanupUploads = cleanup;

    // Create error handler
    const originalNext = next;
    const wrappedNext = (err) => {
      if (err) {
        // Error occurred - cleanup uploaded files
        cleanup();
      }
      return originalNext(err);
    };

    // Intercept res.json to catch validation errors
    const originalJson = res.json;
    res.json = function(data) {
      // Check if this is a validation error response
      if (data.success === false || (data.errors && data.errors.length > 0)) {
        cleanup();
      }
      return originalJson.call(this, data);
    };

    // Run validation
    validate(validationSchema)(req, res, wrappedNext);
  };
};

module.exports = { validateWithCleanup };
