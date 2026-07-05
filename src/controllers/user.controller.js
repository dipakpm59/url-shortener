const userService = require('../services/user.service');
const urlService = require('../services/url.service');
const analyticsService = require('../services/analytics.service');
const { validateRegisterPayload } = require('../validators/user.validator');
const { validateLoginPayload } = require('../validators/auth.validator');
const asyncHandler = require('../utils/asyncHandler');
const httpStatus = require('../constants/httpStatus');
const messages = require('../constants/messages');
const env = require('../config/env');

function setAuthCookie(res, token, rememberMe) {
  res.cookie(env.cookie.name, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    ...(rememberMe ? { maxAge: env.cookie.maxAgeMs } : {}),
  });
}

const register = asyncHandler(async (req, res) => {
  validateRegisterPayload(req.body);
  const { username, email, password } = req.body;

  const user = await userService.register({ username, email, password });

  res.status(httpStatus.CREATED).json({ success: true, message: messages.USER.REGISTERED, data: { user } });
});

const login = asyncHandler(async (req, res) => {
  validateLoginPayload(req.body);
  const { identifier, password, rememberMe } = req.body;

  const { token, user } = await userService.login({ identifier, password });
  setAuthCookie(res, token, Boolean(rememberMe));

  res.status(httpStatus.OK).json({ success: true, message: 'Login successful.', data: { user } });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie(env.cookie.name);
  res.status(httpStatus.OK).json({ success: true, message: 'Logged out.' });
});

const me = asyncHandler(async (req, res) => {
  res.status(httpStatus.OK).json({ success: true, data: { user: req.user } });
});

const myUrls = asyncHandler(async (req, res) => {
  const result = await urlService.listMyUrls(req.user.id, req.query);
  res.status(httpStatus.OK).json({ success: true, ...result });
});

const deleteMyUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await urlService.deleteOwnUrl(req.user.id, id);
  res.status(httpStatus.OK).json({ success: true, message: messages.URL.DELETED_SUCCESS, data });
});

const myAnalytics = asyncHandler(async (req, res) => {
  const summary = await analyticsService.getUserDashboardSummary(req.user.id);
  res.status(httpStatus.OK).json({ success: true, data: summary });
});

module.exports = { register, login, logout, me, myUrls, deleteMyUrl, myAnalytics };
