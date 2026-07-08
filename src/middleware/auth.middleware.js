const { verifyToken } = require('../utils/jwt');
const adminModel = require('../models/admin.model');
const userModel = require('../models/user.model');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');
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
    req.tokenPayload = verifyToken(token);
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
    if (req.tokenPayload.role !== 'ADMIN') {
      res.clearCookie(env.cookie.name);
      return next(unauthorized('Not authenticated.'));
    }
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

/**
 * Mirrors authenticateAdmin, against the users table instead — plus an
 * is_active check with no admin equivalent, since only regular users can be
 * disabled. Checked here (not just at login) so disabling an account cuts
 * off an already-issued, still-valid JWT immediately, rather than waiting
 * for it to expire naturally.
 */
async function authenticateUser(req, res, next) {
  try {
    if (req.tokenPayload.role !== 'USER') {
      res.clearCookie(env.cookie.name);
      return next(unauthorized('Not authenticated.'));
    }
    const user = await userModel.findById(req.tokenPayload.sub);
    if (!user) {
      res.clearCookie(env.cookie.name);
      return next(unauthorized('User account no longer exists.'));
    }
    if (!user.is_active) {
      res.clearCookie(env.cookie.name);
      return next(unauthorized('This account has been disabled.'));
    }
    req.user = userService.toPublicUser(user);
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireUser(req, res, next) {
  if (!req.user) {
    return next(unauthorized('Not authenticated.'));
  }
  return next();
}

/**
 * Used only on routes either an ADMIN or a USER may hit (currently just URL
 * creation, since ownership is written at creation time). Dispatches to the
 * matching table based on the JWT's `role` claim and normalizes both shapes
 * into req.actor, so downstream code doesn't need to care which table the
 * caller came from.
 */
async function identifyActor(req, res, next) {
  try {
    const { role, sub } = req.tokenPayload;

    if (role === 'ADMIN') {
      const admin = await adminModel.findById(sub);
      if (!admin) return next(unauthorized('Admin account no longer exists.'));
      req.actor = { id: admin.id, role: 'ADMIN', username: admin.username };
      return next();
    }

    if (role === 'USER') {
      const user = await userModel.findById(sub);
      if (!user) return next(unauthorized('User account no longer exists.'));
      if (!user.is_active) return next(unauthorized('This account has been disabled.'));
      req.actor = { id: user.id, role: 'USER', username: user.username };
      return next();
    }

    return next(unauthorized('Invalid session. Please login again.', true));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  verifyJWT,
  authenticateAdmin,
  requireAdmin,
  authenticateUser,
  requireUser,
  identifyActor,
};
