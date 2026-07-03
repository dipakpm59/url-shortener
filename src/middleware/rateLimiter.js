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

// Requesting a reset code sends a real email — throttle hard to stop this
// being used to spam an inbox or hammer the Gmail SMTP quota.
const otpRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: httpStatus.TOO_MANY_REQUESTS,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many reset requests. Please try again later.',
  },
});

// A 6-digit OTP has only 1,000,000 possibilities — without a tight limit on
// verification attempts, it's brute-forceable well within its 10-minute
// expiry window. This is the control that actually makes that infeasible.
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  statusCode: httpStatus.TOO_MANY_REQUESTS,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many attempts. Please try again later.',
  },
});

module.exports = { apiLimiter, shortenLimiter, loginLimiter, otpRequestLimiter, otpVerifyLimiter };
