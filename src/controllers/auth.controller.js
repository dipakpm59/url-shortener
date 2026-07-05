const authService = require('../services/auth.service');
const {
  validateLoginPayload,
  validateChangePasswordPayload,
} = require('../validators/auth.validator');
const asyncHandler = require('../utils/asyncHandler');
const httpStatus = require('../constants/httpStatus');
const env = require('../config/env');

function requestMeta(req) {
  return { ipAddress: req.ip || req.socket?.remoteAddress || '', userAgent: req.get('user-agent') || null };
}

function setAuthCookie(res, token, rememberMe) {
  res.cookie(env.cookie.name, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    // "Remember me" unchecked -> session cookie (no maxAge, dies with the
    // browser). Checked -> persists on disk until the JWT itself expires.
    // Either way the JWT's own 2h expiry is the real security boundary.
    ...(rememberMe ? { maxAge: env.cookie.maxAgeMs } : {}),
  });
}

const login = asyncHandler(async (req, res) => {
  validateLoginPayload(req.body);
  const { identifier, password, rememberMe } = req.body;

  const { token, admin } = await authService.login({ identifier, password, ...requestMeta(req) });
  setAuthCookie(res, token, Boolean(rememberMe));

  res.status(httpStatus.OK).json({ success: true, message: 'Login successful.', data: { admin } });
});

const logout = asyncHandler(async (req, res) => {
  if (req.admin) {
    await authService.logout({ adminId: req.admin.id, ...requestMeta(req) });
  }
  res.clearCookie(env.cookie.name);
  res.status(httpStatus.OK).json({ success: true, message: 'Logged out.' });
});

const me = asyncHandler(async (req, res) => {
  res.status(httpStatus.OK).json({ success: true, data: { admin: req.admin } });
});

const changePassword = asyncHandler(async (req, res) => {
  validateChangePasswordPayload(req.body);
  const { currentPassword, newPassword } = req.body;

  await authService.changePassword({
    adminId: req.admin.id,
    currentPassword,
    newPassword,
    ...requestMeta(req),
  });

  res.status(httpStatus.OK).json({ success: true, message: 'Password changed successfully.' });
});

module.exports = { login, logout, me, changePassword };
