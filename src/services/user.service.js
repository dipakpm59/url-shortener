const userModel = require('../models/user.model');
const { hashPassword, comparePassword, isPasswordComplex } = require('../utils/password');
const { signUserToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const messages = require('../constants/messages');
const env = require('../config/env');

function toPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isActive: Boolean(user.is_active),
    createdAt: user.created_at,
  };
}

function isLocked(user) {
  return Boolean(user.locked_until) && new Date(user.locked_until).getTime() > Date.now();
}

function lockRemainingMinutes(user) {
  return Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
}

async function register({ username, email, password }) {
  if (!isPasswordComplex(password)) {
    throw new AppError(
      'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
      httpStatus.BAD_REQUEST
    );
  }

  // Checked separately (not a combined OR-on-one-value lookup) so the error
  // correctly identifies which field collided.
  if (await userModel.findByEmail(email)) {
    throw new AppError(messages.USER.EMAIL_TAKEN, httpStatus.CONFLICT);
  }
  if (await userModel.findByUsername(username)) {
    throw new AppError(messages.USER.USERNAME_TAKEN, httpStatus.CONFLICT);
  }

  const passwordHash = await hashPassword(password);
  const user = await userModel.create({ username, email, passwordHash });
  return toPublicUser(user);
}

async function login({ identifier, password }) {
  const user = await userModel.findByEmailOrUsername(identifier);

  // Same generic message whether the identifier doesn't exist or the
  // password is wrong — never reveal which one was incorrect (prevents
  // user enumeration), matching auth.service.js's admin login.
  const invalidCredentialsError = () =>
    new AppError('Invalid email/username or password.', httpStatus.UNAUTHORIZED);

  if (!user) {
    throw invalidCredentialsError();
  }

  if (!user.is_active) {
    throw new AppError('This account has been disabled.', httpStatus.FORBIDDEN);
  }

  if (isLocked(user)) {
    throw new AppError(
      `Account locked due to too many failed attempts. Try again in ${lockRemainingMinutes(user)} minute(s).`,
      httpStatus.FORBIDDEN
    );
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    await userModel.incrementFailedAttempts(user.id);
    const attemptsNow = user.failed_attempts + 1;

    if (attemptsNow >= env.loginAttempts.max) {
      const lockedUntil = new Date(Date.now() + env.loginAttempts.lockMinutes * 60 * 1000);
      await userModel.lockAccount(user.id, lockedUntil);
      throw new AppError(
        `Too many failed attempts. Account locked for ${env.loginAttempts.lockMinutes} minutes.`,
        httpStatus.FORBIDDEN
      );
    }

    throw invalidCredentialsError();
  }

  await userModel.resetFailedAttempts(user.id);

  const token = signUserToken(user);
  return { token, user: toPublicUser(user) };
}

async function getCurrentUser(userId) {
  const user = await userModel.findById(userId);
  if (!user) throw new AppError('User not found.', httpStatus.NOT_FOUND);
  return toPublicUser(user);
}

async function listAllUsers(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const { rows, total } = await userModel.list({ limit, offset, search: query.search || '' });

  return {
    data: rows.map(toPublicUser),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

async function setUserActive(id, isActive) {
  const updated = await userModel.setActive(id, isActive);
  if (!updated) throw new AppError('User not found.', httpStatus.NOT_FOUND);
  return getCurrentUser(id);
}

async function deleteUser(id) {
  const deleted = await userModel.deleteById(id);
  if (!deleted) throw new AppError('User not found.', httpStatus.NOT_FOUND);
}

module.exports = {
  register,
  login,
  getCurrentUser,
  listAllUsers,
  setUserActive,
  deleteUser,
  toPublicUser,
};
