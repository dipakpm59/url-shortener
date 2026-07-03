const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const messages = require('../constants/messages');

function notFound(req, res, next) {
  next(new AppError(messages.SERVER.ROUTE_NOT_FOUND, httpStatus.NOT_FOUND));
}

module.exports = notFound;
