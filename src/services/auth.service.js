const adminModel = require('../models/admin.model');
const adminLogModel = require('../models/adminLog.model');
const { hashPassword, comparePassword, isPasswordComplex } = require('../utils/password');
const { signAdminToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const env = require('../config/env');

function toPublicAdmin(admin) {
  return {
    id: admin.id,
    username: admin.username,
    email: admin.email,
    createdAt: admin.created_at,
  };
}

function isLocked(admin) {
  return Boolean(admin.locked_until) && new Date(admin.locked_until).getTime() > Date.now();
}

function lockRemainingMinutes(admin) {
  return Math.ceil((new Date(admin.locked_until).getTime() - Date.now()) / 60000);
}

async function login({ identifier, password, ipAddress, userAgent }) {
  const admin = await adminModel.findByEmailOrUsername(identifier);

  // Same generic message whether the identifier doesn't exist or the
  // password is wrong — never reveal which one was incorrect (prevents
  // user enumeration).
  const invalidCredentialsError = () =>
    new AppError('Invalid email/username or password.', httpStatus.UNAUTHORIZED);

  if (!admin) {
    await adminLogModel.record({ action: 'login_failed', details: `unknown identifier: ${identifier}`, ipAddress, userAgent });
    throw invalidCredentialsError();
  }

  if (isLocked(admin)) {
    await adminLogModel.record({ adminId: admin.id, action: 'login_blocked_locked', ipAddress, userAgent });
    throw new AppError(
      `Account locked due to too many failed attempts. Try again in ${lockRemainingMinutes(admin)} minute(s).`,
      httpStatus.FORBIDDEN
    );
  }

  const passwordMatches = await comparePassword(password, admin.password_hash);
  if (!passwordMatches) {
    await adminModel.incrementFailedAttempts(admin.id);
    const attemptsNow = admin.failed_attempts + 1;

    if (attemptsNow >= env.loginAttempts.max) {
      const lockedUntil = new Date(Date.now() + env.loginAttempts.lockMinutes * 60 * 1000);
      await adminModel.lockAccount(admin.id, lockedUntil);
      await adminLogModel.record({ adminId: admin.id, action: 'account_locked', ipAddress, userAgent });
      throw new AppError(
        `Too many failed attempts. Account locked for ${env.loginAttempts.lockMinutes} minutes.`,
        httpStatus.FORBIDDEN
      );
    }

    await adminLogModel.record({ adminId: admin.id, action: 'login_failed', ipAddress, userAgent });
    throw invalidCredentialsError();
  }

  await adminModel.resetFailedAttempts(admin.id);
  await adminLogModel.record({ adminId: admin.id, action: 'login', ipAddress, userAgent });

  const token = signAdminToken(admin);
  return { token, admin: toPublicAdmin(admin) };
}

async function logout({ adminId, ipAddress, userAgent }) {
  await adminLogModel.record({ adminId, action: 'logout', ipAddress, userAgent });
}

async function getCurrentAdmin(adminId) {
  const admin = await adminModel.findById(adminId);
  if (!admin) throw new AppError('Admin not found.', httpStatus.NOT_FOUND);
  return toPublicAdmin(admin);
}

async function changePassword({ adminId, currentPassword, newPassword, ipAddress, userAgent }) {
  const admin = await adminModel.findById(adminId);
  if (!admin) throw new AppError('Admin not found.', httpStatus.NOT_FOUND);

  const currentMatches = await comparePassword(currentPassword, admin.password_hash);
  if (!currentMatches) {
    throw new AppError('Current password is incorrect.', httpStatus.BAD_REQUEST);
  }

  if (!isPasswordComplex(newPassword)) {
    throw new AppError(
      'New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
      httpStatus.BAD_REQUEST
    );
  }

  const newHash = await hashPassword(newPassword);
  await adminModel.updatePasswordHash(admin.id, newHash);
  await adminLogModel.record({ adminId: admin.id, action: 'password_change', ipAddress, userAgent });
}

module.exports = {
  login,
  logout,
  getCurrentAdmin,
  changePassword,
  toPublicAdmin,
};
