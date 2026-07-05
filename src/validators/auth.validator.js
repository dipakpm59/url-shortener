const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');

function validateLoginPayload(body) {
  const { identifier, password } = body;
  if (!identifier || typeof identifier !== 'string') {
    throw new AppError('Email or username is required.', httpStatus.BAD_REQUEST);
  }
  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required.', httpStatus.BAD_REQUEST);
  }
}

function validateChangePasswordPayload(body) {
  const { currentPassword, newPassword, confirmPassword } = body;
  if (!currentPassword || typeof currentPassword !== 'string') {
    throw new AppError('Current password is required.', httpStatus.BAD_REQUEST);
  }
  if (!newPassword || typeof newPassword !== 'string') {
    throw new AppError('New password is required.', httpStatus.BAD_REQUEST);
  }
  if (newPassword !== confirmPassword) {
    throw new AppError('New password and confirmation do not match.', httpStatus.BAD_REQUEST);
  }
}

module.exports = {
  validateLoginPayload,
  validateChangePasswordPayload,
};
