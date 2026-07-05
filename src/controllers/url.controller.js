const urlService = require('../services/url.service');
const { validateCreateUrlPayload, validateLongUrl } = require('../validators/url.validator');
const { generateQrCodeDataUrl } = require('../services/qrcode.service');
const adminLogModel = require('../models/adminLog.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const messages = require('../constants/messages');

const createShortUrl = asyncHandler(async (req, res) => {
  validateCreateUrlPayload(req.body);
  const { longUrl, expiresAt } = req.body;

  const { data, reused } = await urlService.createShortUrl({ longUrl, expiresAt }, req.actor);

  res.status(reused ? httpStatus.OK : httpStatus.CREATED).json({
    success: true,
    message: reused ? 'This URL was already shortened. Returning the existing short URL.' : messages.URL.CREATED,
    data,
  });
});

const getUrlDetails = asyncHandler(async (req, res) => {
  const { shortCode } = req.params;
  const { row } = await urlService.resolveShortUrl(shortCode);
  res.status(httpStatus.OK).json({ success: true, data: urlService.toPublicShape(row) });
});

const getQrCode = asyncHandler(async (req, res) => {
  const { shortCode } = req.params;
  const { row } = await urlService.resolveShortUrl(shortCode);
  const qrDataUrl = await generateQrCodeDataUrl(`${req.app.locals.baseUrl}/${row.short_code}`);
  res.status(httpStatus.OK).json({ success: true, data: { qrCode: qrDataUrl } });
});

const updateUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { longUrl } = req.body;
  if (!longUrl) throw new AppError('longUrl is required.', httpStatus.BAD_REQUEST);
  validateLongUrl(longUrl);
  const data = await urlService.updateUrl(id, longUrl);
  res.status(httpStatus.OK).json({ success: true, message: messages.URL.UPDATED, data });
});

const deleteUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await urlService.softDeleteUrl(id);
  await adminLogModel.record({
    adminId: req.admin.id,
    action: 'delete_url',
    details: `short_code=${data.shortCode}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(httpStatus.OK).json({ success: true, message: messages.URL.DELETED_SUCCESS, data });
});

const restoreUrl = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = await urlService.restoreUrl(id);
  await adminLogModel.record({
    adminId: req.admin.id,
    action: 'restore_url',
    details: `short_code=${data.shortCode}`,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.status(httpStatus.OK).json({ success: true, message: messages.URL.RESTORED, data });
});

module.exports = { createShortUrl, getUrlDetails, getQrCode, updateUrl, deleteUrl, restoreUrl };
