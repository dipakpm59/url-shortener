const validator = require('validator');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const messages = require('../constants/messages');

function validateLongUrl(longUrl) {
  if (!longUrl || typeof longUrl !== 'string') {
    throw new AppError(messages.URL.INVALID_URL, httpStatus.BAD_REQUEST);
  }
  const isValid = validator.isURL(longUrl, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
  });
  if (!isValid) {
    throw new AppError(messages.URL.INVALID_URL, httpStatus.BAD_REQUEST);
  }
}

function validateExpiryDate(expiresAt) {
  if (expiresAt === undefined || expiresAt === null || expiresAt === '') return;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Invalid expiry date format.', httpStatus.BAD_REQUEST);
  }
  if (date.getTime() <= Date.now()) {
    throw new AppError('Expiry date must be in the future.', httpStatus.BAD_REQUEST);
  }
}

function validateCreateUrlPayload(body) {
  const { longUrl, expiresAt } = body;
  validateLongUrl(longUrl);
  validateExpiryDate(expiresAt);
}

module.exports = {
  validateLongUrl,
  validateExpiryDate,
  validateCreateUrlPayload,
};
