const helmet = require('helmet');
const cors = require('cors');
const hpp = require('hpp');
const compression = require('compression');
const xss = require('xss');
const env = require('./../config/env');

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
      scriptSrc: ["'self'", 'cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'cdn.jsdelivr.net'],
    },
  },
});

const corsMiddleware = cors({
  origin: env.security.corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
});

function sanitizeValue(value) {
  if (typeof value === 'string') return xss(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v)])
    );
  }
  return value;
}

function xssSanitizer(req, res, next) {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
}

module.exports = {
  helmetMiddleware,
  corsMiddleware,
  hppMiddleware: hpp(),
  compressionMiddleware: compression(),
  xssSanitizer,
};
