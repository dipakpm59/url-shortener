const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// At least 8 chars, one uppercase, one lowercase, one digit, one special character.
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function isPasswordComplex(plain) {
  return typeof plain === 'string' && PASSWORD_COMPLEXITY_REGEX.test(plain);
}

module.exports = { hashPassword, comparePassword, isPasswordComplex };
