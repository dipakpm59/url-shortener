const jwt = require('jsonwebtoken');
const env = require('../config/env');

/** Signs a JWT for an admin. Payload is intentionally minimal (id + username only). */
function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, username: admin.username }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

/** Throws jsonwebtoken's own TokenExpiredError / JsonWebTokenError on failure. */
function verifyAdminToken(token) {
  return jwt.verify(token, env.jwt.secret);
}

module.exports = { signAdminToken, verifyAdminToken };
