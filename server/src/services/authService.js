const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const config = require('../config');
const { throwError } = require('../utils/responseHandler');
const { encodePermissions } = require('../constants/permissions');
const { generateOTP, hashOTP } = require('../utils/token');
const { sendVerificationOTP, sendPasswordResetOTP } = require('../utils/mailer');

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

const generateJWT = (payload) =>
  jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

/** Session token for a user: id, role name and the role's permissions as a bitmask. */
const issueToken = (user, permissions) => generateJWT({
  id:   user.id,
  role: user.role?.name || null,
  p:    encodePermissions(permissions || []),
});

const login = async (email, password) => {
  if (!email || !password) throwError('Email and password are required', 400);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: { select: { id: true, name: true, permissions: true } } },
  });

  if (!user) throwError('Invalid email or password', 401);

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throwError('Invalid email or password', 401);

  if (!user.isEmailVerified)    throwError('Please verify your email before logging in', 403);
  if (user.status !== 'active') throwError('Your account is not active. Please contact support.', 403);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const permissions = user.role?.permissions || [];
  const token = issueToken(user, permissions);

  const { password: _, ...userObj } = user;
  userObj.role = user.role ? { id: user.role.id, name: user.role.name } : null;

  return { user: userObj, permissions, token };
};

// JWTs are stateless — logout is handled client-side by discarding the token.
// Kept as a hook for future server-side session/refresh-token revocation.
const logout = async () => {};

// Self-registered accounts always get the default role (see seeds/roles.js).
// Staff/admin roles can never be assigned via registration.
const register = async ({ name, email, password, phone }) => {
  const appConfig = await prisma.config.findUnique({ where: { key: 'app_config' } });
  if (appConfig && appConfig.registrationEnabled === false) throwError('Registration is currently disabled', 403);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing?.isEmailVerified) throwError('Email is already registered', 409);

  const { otp, hash } = generateOTP();
  await sendVerificationOTP(email, otp);

  const passwordHash = await bcrypt.hash(password, 10);
  const expiry = new Date(Date.now() + OTP_EXPIRY_MS);

  const defaultRole = await prisma.role.findFirst({ where: { isDefault: true }, select: { id: true } });
  const roleId = defaultRole?.id || null;

  const data = {
    name,
    password: passwordHash,
    emailVerificationToken: hash,
    emailVerificationExpires: expiry,
    roleId,
    ...(phone ? { phone } : {}),
  };

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data })
    : await prisma.user.create({ data: { ...data, email } });

  const { password: _, emailVerificationToken: __, ...userObj } = user;
  return { user: userObj };
};

const verifyEmail = async (email, otp) => {
  if (!email || !otp) throwError('Email and OTP are required', 400);

  const hash = hashOTP(otp);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.emailVerificationToken !== hash) throwError('Invalid OTP', 400);
  if (user.emailVerificationExpires < new Date()) throwError('OTP has expired. Please request a new one.', 400);

  // Accounts are activated on email verification. To require admin approval
  // instead, set status to 'pending' here and activate via PATCH /users/:id.
  const status = 'active';

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      status,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return { status };
};

const resendVerification = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;
  if (user.isEmailVerified) throwError('Email is already verified', 400);

  const { otp, hash } = generateOTP();
  await sendVerificationOTP(user.email, otp);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: hash,
      emailVerificationExpires: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });
};

const forgotPassword = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return;

  const { otp, hash } = generateOTP();
  await sendPasswordResetOTP(user.email, otp);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hash,
      passwordResetExpires: new Date(Date.now() + OTP_EXPIRY_MS),
    },
  });
};

const resetPassword = async (email, otp, newPassword) => {
  if (!email || !otp || !newPassword) throwError('Email, OTP and new password are required', 400);
  if (newPassword.length < 6) throwError('Password must be at least 6 characters', 400);

  const hash = hashOTP(otp);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || user.passwordResetToken !== hash) throwError('Invalid OTP', 400);
  if (user.passwordResetExpires < new Date()) throwError('OTP has expired. Please request a new one.', 400);

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
};

module.exports = {
  issueToken,
  login,
  logout,
  register,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
