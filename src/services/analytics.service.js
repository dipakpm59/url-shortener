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

module.exports = { getDashboardSummary };
