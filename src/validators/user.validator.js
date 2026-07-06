const validator = require('validator');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/;

function validateRegisterPayload(body) {
  const { username, email, password } = body;
  if (!username || typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    throw new AppError(
      'Username must be 3-50 characters: letters, numbers, underscores only.',
      httpStatus.BAD_REQUEST
    );
  }
  if (!email || !validator.isEmail(email)) {
    throw new AppError('A valid email is required.', httpStatus.BAD_REQUEST);
  }
  if (!password || typeof password !== 'string') {
    throw new AppError('Password is required.', httpStatus.BAD_REQUEST);
  }
}

function validateUpdateUserPayload(body) {
  const { isActive } = body;
  if (typeof isActive !== 'boolean') {
    throw new AppError('isActive (boolean) is required.', httpStatus.BAD_REQUEST);
  }
}

module.exports = { validateRegisterPayload, validateUpdateUserPayload };
