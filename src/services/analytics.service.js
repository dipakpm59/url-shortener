const urlModel = require('../models/url.model');
const clickEventModel = require('../models/clickEvent.model');
const urlCache = require('./cache.service');

async function getDashboardSummary() {
  const totals = await urlModel.countAll();
  const mostClicked = await urlModel.mostClicked(10);
  const clicksOverTime = await clickEventModel.clicksOverTime(14);
  const cacheStats = urlCache.statistics();

  return {
    totals: {
      totalUrls: Number(totals.totalUrls) || 0,
      totalClicks: Number(totals.totalClicks) || 0,
      deletedUrls: Number(totals.deletedUrls) || 0,
      expiredUrls: Number(totals.expiredUrls) || 0,
    },
    mostClicked,
    clicksOverTime,
    cacheStats,
  };
}

// Same shape as getDashboardSummary, scoped to one user's own links. No
// cacheStats here — the LRU cache is shared/global infrastructure, not a
// meaningful per-user metric.
async function getUserDashboardSummary(userId) {
  const totals = await urlModel.countAllByOwnerUser(userId);
  const mostClicked = await urlModel.mostClickedByOwnerUser(userId, 10);
  const clicksOverTime = await clickEventModel.clicksOverTimeByOwnerUser(userId, 14);

  return {
    totals: {
      totalUrls: Number(totals.totalUrls) || 0,
      totalClicks: Number(totals.totalClicks) || 0,
      deletedUrls: Number(totals.deletedUrls) || 0,
      expiredUrls: Number(totals.expiredUrls) || 0,
    },
    mostClicked,
    clicksOverTime,
  };
}

module.exports = { getDashboardSummary, getUserDashboardSummary };
