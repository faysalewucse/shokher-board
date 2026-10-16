const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { throwError } = require('../utils/responseHandler');
const notificationService = require('./notificationService');

const ROLE_SUMMARY = { role: { select: { id: true, name: true } } };

// Strip secrets before returning a user to a client.
const sanitize = (user) => {
  // eslint-disable-next-line no-unused-vars
  const { password, emailVerificationToken, passwordResetToken, ...rest } = user;
  return rest;
};

const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: { select: { id: true, name: true, permissions: true } } },
  });

  if (!user) throwError('User not found', 404);

  const permissions = user.role?.permissions || [];
  const userObj = sanitize(user);
  userObj.role = user.role ? { id: user.role.id, name: user.role.name } : null;

  return { user: userObj, permissions };
};

const getAllUsers = async ({ page = 1, limit = 10, search = '', status = '', role = '', dateFrom = '', dateTo = '' }) => {
  const where = {};

  if (search) {
    where.OR = [
      { name:  { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
    ];
  }

  if (status) where.status = status;
  if (role)   where.roleId = role;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: ROLE_SUMMARY,
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(sanitize),
    meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
  };
};

const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: { select: { id: true, name: true, permissions: true } } },
  });
  if (!user) throwError('User not found', 404);
  return { user: sanitize(user) };
};

const assertRoleExists = async (roleId) => {
  if (!roleId) return;
  const role = await prisma.role.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) throwError('Role not found', 404);
};

const createUser = async ({ name, email, password, role, status, phone }) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throwError('Email is already registered', 409);

  await assertRoleExists(role);

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: passwordHash,
      roleId: role || null,
      status: status || 'active',
      phone: phone || null,
      isEmailVerified: true,
    },
    include: ROLE_SUMMARY,
  });

  return { user: sanitize(user) };
};

const updateUser = async (id, { name, phone, status, role }) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throwError('User not found', 404);

  const data = {};
  if (role !== undefined) {
    await assertRoleExists(role);
    data.roleId = role || null;
  }
  if (name   !== undefined) data.name   = name;
  if (phone  !== undefined) data.phone  = phone;
  if (status !== undefined) data.status = status;

  const updated = await prisma.user.update({ where: { id }, data, include: ROLE_SUMMARY });
  return { user: sanitize(updated) };
};

const deleteUser = async (id, requesterId) => {
  if (id === requesterId) throwError('You cannot delete your own account', 400);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throwError('User not found', 404);

  // Notifications cascade; audit logs keep the row with actorId set to null.
  await prisma.user.delete({ where: { id } });
};

const assignRole = async (id, roleId, requesterId) => {
  if (id === requesterId) throwError('You cannot assign a role to yourself', 400);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throwError('User not found', 404);

  await assertRoleExists(roleId);

  const updated = await prisma.user.update({
    where: { id },
    data: { roleId: roleId || null },
    include: ROLE_SUMMARY,
  });
  return { user: sanitize(updated) };
};

// Writes an in-app notification (persisted + emitted over Socket.IO).
const sendNotificationToUser = async (id, { title, body, actionUrl }) => {
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throwError('User not found', 404);

  await notificationService.createNotification({
    userId: id,
    type: 'admin.message',
    title,
    message: body,
    actionUrl: actionUrl || null,
    actionLabel: actionUrl ? 'View' : null,
    priority: 'normal',
  });
};

// ─── Self-service profile ────────────────────────────────────────────────────

const updateMe = async (userId, { name, phone }) => {
  const data = {};
  if (name  !== undefined) data.name  = name;
  if (phone !== undefined) data.phone = phone;

  const updated = await prisma.user.update({ where: { id: userId }, data, include: ROLE_SUMMARY });
  return { user: sanitize(updated) };
};

const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throwError('User not found', 404);

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throwError('Current password is incorrect', 400);

  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { password: hash } });
};

const updateAvatar = async (userId, avatarUrl) => {
  const updated = await prisma.user.update({ where: { id: userId }, data: { avatar: avatarUrl } });
  return { user: sanitize(updated) };
};

/**
 * Lightweight active-user search for assignee/member pickers → UserLite[].
 */
const lookupUsers = async ({ q = '', limit = 20 } = {}) => {
  const take = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const where = { status: 'active' };
  const term = String(q || '').trim();
  if (term) {
    where.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }
  return prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, avatar: true },
    orderBy: { name: 'asc' },
    take,
  });
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
  sendNotificationToUser,
  updateMe,
  changePassword,
  updateAvatar,
};
