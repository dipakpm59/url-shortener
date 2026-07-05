const urlService = require('../services/url.service');
const userService = require('../services/user.service');
const analyticsService = require('../services/analytics.service');
const urlCache = require('../services/cache.service');
const adminLogModel = require('../models/adminLog.model');
const { validateUpdateUserPayload } = require('../validators/user.validator');
const asyncHandler = require('../utils/asyncHandler');
const httpStatus = require('../constants/httpStatus');

const listUrls = asyncHandler(async (req, res) => {
  const result = await urlService.listUrls(req.query);
  res.status(httpStatus.OK).json({ success: true, ...result });
});

const getDashboard = asyncHandler(async (req, res) => {
  const summary = await analyticsService.getDashboardSummary();
  res.status(httpStatus.OK).json({ success: true, data: summary });
});

const getAnalytics = asyncHandler(async (req, res) => {
  const summary = await analyticsService.getDashboardSummary();
  res.status(httpStatus.OK).json({
    success: true,
    data: { mostClicked: summary.mostClicked, clicksOverTime: summary.clicksOverTime },
  });
});

const getCacheStats = asyncHandler(async (req, res) => {
  res.status(httpStatus.OK).json({ success: true, data: urlCache.statistics() });
});

const clearCache = asyncHandler(async (req, res) => {
  urlCache.clear();
  res.status(httpStatus.OK).json({ success: true, message: 'Cache cleared.' });
});

const listUsers = asyncHandler(async (req, res) => {
  const result = await userService.listAllUsers(req.query);
  res.status(httpStatus.OK).json({ success: true, ...result });
});

const updateUser = asyncHandler(async (req, res) => {
  validateUpdateUserPayload(req.body);
  const { id } = req.params;
  const { isActive } = req.body;

  const data = await userService.setUserActive(id, isActive);
  await adminLogModel.record({
    adminId: req.admin.id,
    action: isActive ? 'enable_user' : 'disable_user',
    details: `user_id=${id}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(httpStatus.OK).json({ success: true, message: `User ${isActive ? 'enabled' : 'disabled'}.`, data });
});

const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await userService.deleteUser(id);
  await adminLogModel.record({
    adminId: req.admin.id,
    action: 'delete_user',
    details: `user_id=${id}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(httpStatus.OK).json({ success: true, message: 'User deleted.' });
});

module.exports = { listUrls, getDashboard, getAnalytics, getCacheStats, clearCache, listUsers, updateUser, deleteUser };
