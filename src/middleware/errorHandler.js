const path = require('path');
const env = require('../config/env');
const httpStatus = require('../constants/httpStatus');
const messages = require('../constants/messages');
const logger = require('../utils/logger');

function handleDbError(err) {
  const AppError = require('../utils/AppError');
  if (err.code === 'ER_DUP_ENTRY') {
    return new AppError('A resource with this value already exists.', httpStatus.CONFLICT);
  }
  if (err.code === 'ECONNREFUSED' || err.code === 'PROTOCOL_CONNECTION_LOST') {
    return new AppError('Database is temporarily unavailable.', httpStatus.INTERNAL_SERVER_ERROR);
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  const dbError = err.code ? handleDbError(err) : null;
  if (dbError) error = dbError;

  const statusCode = error.statusCode || httpStatus.INTERNAL_SERVER_ERROR;
  const isOperational = error.isOperational === true;

  logger.error(error.message, {
    statusCode,
    path: req.originalUrl,
    method: req.method,
    stack: env.isProduction ? undefined : error.stack,
  });

  // Browser navigation (e.g. clicking an expired/deleted short link) gets a
  // styled error page instead of a raw JSON blob; API clients still get JSON.
  const wantsHtml = req.accepts('html') && !req.originalUrl.startsWith('/api');

  // An unauthenticated/expired-session page request is sent to the login
  // page rather than a generic error page — this is what makes the
  // "visit /admin -> not logged in -> redirect /login" flow work without
  // every protected route having to duplicate the redirect logic itself.
  if (wantsHtml && statusCode === httpStatus.UNAUTHORIZED) {
    return res.redirect(error.expired ? '/login?expired=1' : '/login');
  }

  if (wantsHtml) {
    const page = statusCode === httpStatus.NOT_FOUND || statusCode === httpStatus.GONE ? '404.html' : '500.html';
    return res.status(statusCode).sendFile(path.join(__dirname, '..', '..', 'views', page));
  }

  res.status(statusCode).json({
    success: false,
    status: error.status || 'error',
    message: isOperational
      ? error.message
      : messages.SERVER.INTERNAL_ERROR,
    ...(env.isProduction ? {} : { stack: error.stack }),
  });
}

module.exports = errorHandler;
