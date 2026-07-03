const validator = require('validator');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');

function validateLoginPayload(body) {
  const { email, password } = body;
  if (!email || !validator.isEmail(email)) {
    throw new AppError('A valid email is required.', httpStatus.BAD_REQUEST);
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

function validateForgotPasswordPayload(body) {
  const { email } = body;
  if (!email || !validator.isEmail(email)) {
    throw new AppError('A valid email is required.', httpStatus.BAD_REQUEST);
  }
}

const OTP_REGEX = /^\d{6}$/;

function validateResetPasswordPayload(body) {
  const { email, otp, newPassword, confirmPassword } = body;
  if (!email || !validator.isEmail(email)) {
    throw new AppError('A valid email is required.', httpStatus.BAD_REQUEST);
  }
  if (!otp || !OTP_REGEX.test(otp)) {
    throw new AppError('A valid 6-digit reset code is required.', httpStatus.BAD_REQUEST);
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
  validateForgotPasswordPayload,
  validateResetPasswordPayload,
};
