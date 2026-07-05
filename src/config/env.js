require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: required('BASE_URL', 'http://localhost:3000'),

  db: {
    host: required('DB_HOST', 'localhost'),
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD || '',
    database: required('DB_NAME', 'url_shortener'),
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
  },

  security: {
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    corsOrigin: process.env.CORS_ORIGIN || '*',
  },

  cache: {
    capacity: parseInt(process.env.CACHE_CAPACITY || '500', 10),
  },

  url: {
    shortCodeLength: parseInt(process.env.SHORT_CODE_LENGTH || '7', 10),
    defaultExpiryDays: process.env.DEFAULT_URL_EXPIRY_DAYS
      ? parseInt(process.env.DEFAULT_URL_EXPIRY_DAYS, 10)
      : null,
    // Applies to role=USER only; admins are uncapped (see url.service.js).
    dailyLimitPerUser: parseInt(process.env.DAILY_URL_LIMIT_PER_USER || '10', 10),
  },

  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '2h',
  },

  cookie: {
    name: process.env.COOKIE_NAME || 'admin_token',
    // maxAge in ms, mirrors JWT expiry (2h) for "remember me" persistent cookies.
    maxAgeMs: 2 * 60 * 60 * 1000,
  },

  loginAttempts: {
    max: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockMinutes: parseInt(process.env.LOCK_DURATION_MINUTES || '15', 10),
  },

  adminSeed: {
    username: process.env.ADMIN_USERNAME || 'admin',
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  },

  isProduction: (process.env.NODE_ENV || 'development') === 'production',
};
