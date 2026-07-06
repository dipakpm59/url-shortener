const rateLimit = require('express-rate-limit');
const env = require('../config/env');
const httpStatus = require('../constants/httpStatus');

const apiLimiter = rateLimit({
  windowMs: env.security.rateLimitWindowMs,
  max: env.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: httpStatus.TOO_MANY_REQUESTS,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many requests. Please try again later.',
  },
});

const shortenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: httpStatus.TOO_MANY_REQUESTS,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many URLs created from this IP. Slow down.',
  },
});

// IP-based throttle on the login endpoint. This is a coarser, complementary
// defense to the per-account lockout in auth.service.js: the account lockout
// stops a single account being brute-forced from many IPs, this stops one
// IP from brute-forcing many/rotating accounts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: httpStatus.TOO_MANY_REQUESTS,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many login attempts from this IP. Please try again later.',
  },
});

module.exports = { apiLimiter, shortenLimiter, loginLimiter };
