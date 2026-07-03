const urlService = require('../services/url.service');
const asyncHandler = require('../utils/asyncHandler');
const httpStatus = require('../constants/httpStatus');
const logger = require('../utils/logger');
const { sha256 } = require('../utils/hash');

const redirectToLongUrl = asyncHandler(async (req, res) => {
  const { shortCode } = req.params;
  const { row } = await urlService.resolveShortUrl(shortCode);

  // Respond immediately — the client should never wait on analytics writes.
  res.redirect(httpStatus.FOUND, row.long_url);

  const ip = req.ip || req.socket?.remoteAddress || '';
  urlService
    .recordClick(shortCode, {
      urlId: row.id,
      referrer: req.get('referer') || null,
      userAgent: req.get('user-agent') || null,
      ipHash: ip ? sha256(ip) : null,
    })
    .catch((err) => logger.error('Failed to record click', { shortCode, error: err.message }));
});

module.exports = { redirectToLongUrl };
