const adminModel = require('../models/admin.model');
const adminLogModel = require('../models/adminLog.model');
const { hashPassword, comparePassword, isPasswordComplex } = require('../utils/password');
const { signAdminToken } = require('../utils/jwt');
const { generateOtp, hashOtp } = require('../utils/otp');
const { sendOtpEmail } = require('./email.service');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const logger = require('../utils/logger');
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

async function login({ email, password, ipAddress, userAgent }) {
  const admin = await adminModel.findByEmail(email);

  // Same generic message whether the email doesn't exist or the password is
  // wrong — never reveal which one was incorrect (prevents user enumeration).
  const invalidCredentialsError = () =>
    new AppError('Invalid email or password.', httpStatus.UNAUTHORIZED);

  if (!admin) {
    await adminLogModel.record({ action: 'login_failed', details: `unknown email: ${email}`, ipAddress, userAgent });
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

const GENERIC_OTP_REQUEST_MESSAGE = 'If that email is registered, a reset code has been sent.';

async function requestPasswordReset({ email, ipAddress, userAgent }) {
  const admin = await adminModel.findByEmail(email);

  // Same response whether or not the email exists — otherwise this endpoint
  // becomes an oracle an attacker can use to enumerate valid admin emails.
  if (!admin) {
    await adminLogModel.record({ action: 'password_reset_requested', details: `unknown email: ${email}`, ipAddress, userAgent });
    return { message: GENERIC_OTP_REQUEST_MESSAGE };
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + env.otp.expiryMinutes * 60 * 1000);
  await adminModel.setResetOtp(admin.id, hashOtp(otp), expiresAt);
  await adminLogModel.record({ adminId: admin.id, action: 'password_reset_requested', ipAddress, userAgent });

  let previewUrl;
  try {
    ({ previewUrl } = await sendOtpEmail(admin.email, otp));
  } catch (err) {
    // Delivery failure shouldn't change the response the client sees (see
    // note above), but it must not be silent either — an admin who never
    // gets their email needs this in the server logs to diagnose.
    logger.error('OTP email delivery failed during password reset request', { adminId: admin.id, error: err.message });
  }

  // Ethereal is a sandboxed test inbox — nothing is ever delivered to a
  // real address, so the only way to actually see the "sent" email is via
  // this preview link. Surfaced only outside production, where a real
  // provider would replace Ethereal entirely and this link wouldn't exist.
  return { message: GENERIC_OTP_REQUEST_MESSAGE, previewUrl: env.isProduction ? undefined : previewUrl };
}

async function resetPasswordWithOtp({ email, otp, newPassword, ipAddress, userAgent }) {
  const admin = await adminModel.findByEmail(email);
  const invalidOtpError = () => new AppError('Invalid or expired reset code.', httpStatus.BAD_REQUEST);

  if (!admin || !admin.reset_otp_hash || !admin.reset_otp_expires) {
    throw invalidOtpError();
  }
  if (new Date(admin.reset_otp_expires).getTime() < Date.now()) {
    throw invalidOtpError();
  }
  if (hashOtp(otp) !== admin.reset_otp_hash) {
    throw invalidOtpError();
  }

  if (!isPasswordComplex(newPassword)) {
    throw new AppError(
      'New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
      httpStatus.BAD_REQUEST
    );
  }

  const newHash = await hashPassword(newPassword);
  await adminModel.updatePasswordHash(admin.id, newHash);
  await adminModel.clearResetOtp(admin.id);
  // A successful reset is a legitimate proof of email ownership — unlock
  // the account too, so a locked-out admin has a real self-service way out.
  await adminModel.resetFailedAttempts(admin.id);
  await adminLogModel.record({ adminId: admin.id, action: 'password_reset', ipAddress, userAgent });
}

module.exports = {
  login,
  logout,
  getCurrentAdmin,
  changePassword,
  requestPasswordReset,
  resetPasswordWithOtp,
  toPublicAdmin,
};
