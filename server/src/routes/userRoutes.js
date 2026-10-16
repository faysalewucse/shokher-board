const express = require('express');
const {
  getMe, getAllUsers, getUserById, createUser, updateUser, deleteUser, assignRole,
  updateMe, changePassword, updateAvatar, sendNotification, lookupUsers,
} = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');
const { validate }    = require('../middleware/validate');
const { uploadImage, UPLOAD_FOLDERS } = require('../middleware/upload');
const userValidation  = require('../validations/userValidation');

const router = express.Router();

// Self-profile routes
router.get('/me',            authenticate, getMe);
router.patch('/me',          authenticate, validate(userValidation.updateMe),       updateMe);
router.patch('/me/password', authenticate, validate(userValidation.changePassword), changePassword);
router.post('/me/avatar',    authenticate, uploadImage('avatar', UPLOAD_FOLDERS.AVATARS), updateAvatar);

// Lightweight user picker (any logged-in user) — must stay above /:id
router.get('/lookup',        authenticate, lookupUsers);

// Admin user management
router.get('/',       authenticate, authorize('USER_READ_ANY'),   getAllUsers);
router.get('/:id',    authenticate, authorize('USER_READ_ANY'),   getUserById);
router.post('/',      authenticate, authorize('USER_CREATE'),     validate(userValidation.createUser), createUser);
router.patch('/:id',  authenticate, authorize('USER_UPDATE_ANY'), validate(userValidation.updateUser), updateUser);
router.delete('/:id', authenticate, authorize('USER_DELETE_ANY'), deleteUser);
router.patch('/:id/assign-role',      authenticate, authorize('USER_ASSIGN_ROLE'),  validate(userValidation.assignRole),       assignRole);
router.post('/:id/send-notification', authenticate, authorize('NOTIFICATION_SEND'), validate(userValidation.sendNotification), sendNotification);

module.exports = router;
