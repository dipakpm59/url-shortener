const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const routes = require('./routes');
const redirectRoutes = require('./routes/redirect.routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimiter');
const { verifyJWT, authenticateAdmin, requireAdmin } = require('./middleware/auth.middleware');
const {
  helmetMiddleware,
  corsMiddleware,
  hppMiddleware,
  compressionMiddleware,
  xssSanitizer,
} = require('./middleware/security');
const logger = require('./utils/logger');

const app = express();

app.locals.baseUrl = env.baseUrl;
app.set('trust proxy', 1);

// --- Security & performance middleware ---
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(compressionMiddleware);
app.use(hppMiddleware);

// --- Body parsing ---
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(xssSanitizer);

// --- Logging ---
app.use(morgan('combined', { stream: logger.requestStream }));
if (!env.isProduction) app.use(morgan('dev'));

// --- Rate limiting (applies to API routes only, not static assets) ---
app.use('/api', apiLimiter);

// --- Static frontend ---
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'index.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'login.html'));
});
app.get('/admin', verifyJWT, authenticateAdmin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'admin.html'));
});
app.get('/analytics', verifyJWT, authenticateAdmin, requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'analytics.html'));
});

// --- API routes ---
app.use(routes);

// --- Redirect route (must come after API/static routes so it doesn't shadow them) ---
app.use('/', redirectRoutes);

// --- 404 + centralized error handling ---
app.use((req, res, next) => {
  if (req.accepts('html')) {
    return res.status(404).sendFile(path.join(__dirname, '..', 'views', '404.html'));
  }
  return notFound(req, res, next);
});
app.use(errorHandler);

module.exports = app;
