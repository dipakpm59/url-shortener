const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * admins.id and users.id are independent sequences (both start at 1), so
 * `role` is what disambiguates which table a token's `sub` refers to —
 * without it, an admin id=3 and a user id=3 would be indistinguishable.
 */
function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username, role: 'ADMIN' }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function signUserToken(user) {
  return jwt.sign({ sub: user.id, username: user.username, role: 'USER' }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

/** Throws jsonwebtoken's own TokenExpiredError / JsonWebTokenError on failure. */
function verifyToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = { signAdminToken, signUserToken, verifyToken };
