const userService = require('../services/userService');
const { successResponse } = require('../utils/responseHandler');
const { getFileUrl, deleteFileByUrl, UPLOAD_FOLDERS } = require('../middleware/upload');

const getMe = async (req, res, next) => {
  try {
    const result = await userService.getMe(req.user.id);
    return successResponse(res, { message: 'Profile fetched successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, search, status, role, dateFrom, dateTo } = req.query;
    const result = await userService.getAllUsers({ page, limit, search, status, role, dateFrom, dateTo });
    return successResponse(res, { message: 'Users fetched successfully', data: result.users, meta: result.meta });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const result = await userService.getUserById(req.params.id);
    return successResponse(res, { message: 'User fetched successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const result = await userService.createUser(req.body);
    return successResponse(res, { statusCode: 201, message: 'User created successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const result = await userService.updateUser(req.params.id, req.body);
    return successResponse(res, { message: 'User updated successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id, req.user.id);
    return successResponse(res, { message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const assignRole = async (req, res, next) => {
  try {
    const result = await userService.assignRole(req.params.id, req.body.roleId, req.user.id);
    return successResponse(res, { message: 'Role assigned successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const updateMe = async (req, res, next) => {
  try {
    const result = await userService.updateMe(req.user.id, req.body);
    return successResponse(res, { message: 'Profile updated successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await userService.changePassword(req.user.id, currentPassword, newPassword);
    return successResponse(res, { message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' });
    const { user: current } = await userService.getMe(req.user.id);
    const avatarUrl = getFileUrl(req, req.file.filename, UPLOAD_FOLDERS.AVATARS);
    const result = await userService.updateAvatar(req.user.id, avatarUrl);
    // Best-effort removal of the previous local avatar file.
    if (current.avatar && current.avatar.startsWith('/uploads/')) {
      deleteFileByUrl(current.avatar).catch(() => {});
    }
    return successResponse(res, { message: 'Avatar updated successfully', data: result });
  } catch (error) {
    next(error);
  }
};

const sendNotification = async (req, res, next) => {
  try {
    const { title, body, actionUrl } = req.body;
    await userService.sendNotificationToUser(req.params.id, { title, body, actionUrl });
    return successResponse(res, { message: 'Notification sent' });
  } catch (error) {
    next(error);
  }
};

const lookupUsers = async (req, res, next) => {
  try {
    const data = await userService.lookupUsers(req.query);
    return successResponse(res, { message: 'Users fetched successfully', data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  lookupUsers,
  getMe,
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  assignRole,
  updateMe,
  changePassword,
  updateAvatar,
  sendNotification,
};
