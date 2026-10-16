const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  image: 25 * 1024 * 1024, // 25MB
  file: 50 * 1024 * 1024,  // 50MB
  attachment: 20 * 1024 * 1024, // 20MB (card attachments)
};

// Upload folder names
const UPLOAD_FOLDERS = {
  AVATARS:   'avatars',
  DOCUMENTS: 'documents',
  ATTACHMENTS: 'attachments', // card attachments — tracked by the Attachment model
};

// Card attachments accept most file types; block ones that would execute in the
// browser (uploads are served from the API origin) or on a desktop.
const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
  '.html', '.htm', '.xhtml', '.svg', '.js', '.mjs', '.php', '.exe', '.bat', '.cmd', '.sh', '.msi', '.com', '.scr', '.jar',
]);
const BLOCKED_ATTACHMENT_TYPES = new Set([
  'text/html', 'application/xhtml+xml', 'image/svg+xml', 'application/javascript', 'text/javascript',
  'application/x-msdownload', 'application/x-sh',
]);

// Ensure upload directory exists
const ensureDir = (dir) => {
  const fullPath = path.join(__dirname, '../../uploads', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return fullPath;
};

// Dynamic storage configuration
const createStorage = (folder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = ensureDir(folder);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const ext = path.extname(file.originalname).toLowerCase();
      const sanitizedName = file.originalname
        .replace(ext, '')
        .replace(/[^a-zA-Z0-9]/g, '-')
        .substring(0, 20);
      cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
    },
  });
};

// Image filter
const imageFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, PNG, WEBP, and GIF images are allowed'), false);
  }
};

// File filter (images + documents)
const fileFilter = (req, file, cb) => {
  if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};

// Attachment filter (deny-list)
const attachmentFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (BLOCKED_ATTACHMENT_EXTENSIONS.has(ext) || BLOCKED_ATTACHMENT_TYPES.has(file.mimetype)) {
    return cb(new Error('File type not allowed'), false);
  }
  cb(null, true);
};

// Create multer instance for card attachments
const createAttachmentUploader = (maxSize = FILE_SIZE_LIMITS.attachment) => {
  return multer({
    storage: createStorage(UPLOAD_FOLDERS.ATTACHMENTS),
    limits: { fileSize: maxSize, files: 1 },
    fileFilter: attachmentFilter,
  });
};

// Create multer instance for images
const createImageUploader = (folder, maxSize = FILE_SIZE_LIMITS.image) => {
  return multer({
    storage: createStorage(folder),
    limits: { fileSize: maxSize },
    fileFilter: imageFilter,
  });
};

// Create multer instance for files
const createFileUploader = (folder, maxSize = FILE_SIZE_LIMITS.file) => {
  return multer({
    storage: createStorage(folder),
    limits: { fileSize: maxSize },
    fileFilter: fileFilter,
  });
};

// Memory storage for cloud uploads
const createCloudUploader = (type = 'image', maxSize = FILE_SIZE_LIMITS.image) => {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize },
    fileFilter: type === 'image' ? imageFilter : fileFilter,
  });
};

module.exports = {
  createImageUploader,
  createFileUploader,
  createCloudUploader,
  createAttachmentUploader,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_FILE_TYPES,
  FILE_SIZE_LIMITS,
  UPLOAD_FOLDERS,
};
