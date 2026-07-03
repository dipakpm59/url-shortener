const urlService = require('../services/url.service');
const analyticsService = require('../services/analytics.service');
const urlCache = require('../services/cache.service');
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

module.exports = { listUrls, getDashboard, getAnalytics, getCacheStats, clearCache };
