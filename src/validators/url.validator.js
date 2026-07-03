const validator = require('validator');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const messages = require('../constants/messages');

const ALIAS_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;
const RESERVED_ALIASES = new Set(['api', 'admin', 'health', 'static', 'public']);

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

function validateCustomAlias(alias) {
  if (alias === undefined || alias === null || alias === '') return;
  if (typeof alias !== 'string' || !ALIAS_REGEX.test(alias)) {
    throw new AppError(messages.URL.INVALID_ALIAS, httpStatus.BAD_REQUEST);
  }
  if (RESERVED_ALIASES.has(alias.toLowerCase())) {
    throw new AppError('This alias is reserved and cannot be used.', httpStatus.BAD_REQUEST);
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
  const { longUrl, customAlias, expiresAt } = body;
  validateLongUrl(longUrl);
  validateCustomAlias(customAlias);
  validateExpiryDate(expiresAt);
}

module.exports = {
  validateLongUrl,
  validateCustomAlias,
  validateExpiryDate,
  validateCreateUrlPayload,
};
