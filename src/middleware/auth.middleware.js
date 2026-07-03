const { verifyAdminToken } = require('../utils/jwt');
const adminModel = require('../models/admin.model');
const authService = require('../services/auth.service');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const env = require('../config/env');

function unauthorized(message, expired = false) {
  const err = new AppError(message, httpStatus.UNAUTHORIZED);
  err.expired = expired;
  return err;
}

/**
 * Lowest layer: proves the JWT itself is structurally valid and unexpired.
 * Does NOT hit the database — cheap, so it can run on every protected
 * request without adding DB load just to check a signature.
 */
function verifyJWT(req, res, next) {
  const token = req.cookies?.[env.cookie.name];

  if (!token) {
    return next(unauthorized('Not authenticated.'));
  }

  try {
    req.tokenPayload = verifyAdminToken(token);
    return next();
  } catch (err) {
    res.clearCookie(env.cookie.name);
    if (err.name === 'TokenExpiredError') {
      return next(unauthorized('Session expired. Please login again.', true));
    }
    return next(unauthorized('Invalid session. Please login again.', true));
  }
}

/**
 * Runs after verifyJWT. Confirms the admin the token refers to still
 * exists (an admin deleted after a token was issued shouldn't keep
 * working just because their old token hasn't expired yet) and attaches
 * the full admin record to the request for downstream handlers/logging.
 */
async function authenticateAdmin(req, res, next) {
  try {
    const admin = await adminModel.findById(req.tokenPayload.sub);
    if (!admin) {
      res.clearCookie(env.cookie.name);
      return next(unauthorized('Admin account no longer exists.'));
    }
    req.admin = authService.toPublicAdmin(admin);
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Final guard, run after authenticateAdmin. Currently a thin check since
 * this system has exactly one role — kept as its own middleware so a
 * future role system (e.g. requireAdmin(['superadmin'])) has a natural
 * place to grow into without changing every route's middleware chain.
 */
function requireAdmin(req, res, next) {
  if (!req.admin) {
    return next(unauthorized('Not authenticated.'));
  }
  return next();
}

module.exports = { verifyJWT, authenticateAdmin, requireAdmin };
