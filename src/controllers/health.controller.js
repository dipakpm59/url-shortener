const { pool } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const httpStatus = require('../constants/httpStatus');

const healthCheck = asyncHandler(async (req, res) => {
  let dbStatus = 'ok';
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    dbStatus = 'unreachable';
  }

  const payload = {
    success: dbStatus === 'ok',
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatus,
  };

  res.status(dbStatus === 'ok' ? httpStatus.OK : httpStatus.INTERNAL_SERVER_ERROR).json(payload);
});

module.exports = { healthCheck };
