const app = require('./src/app');
const env = require('./src/config/env');
const { testConnection } = require('./src/config/db');
const logger = require('./src/utils/logger');

let server;

async function start() {
  try {
    await testConnection();
    logger.info('MySQL connection pool verified.');
  } catch (err) {
    logger.error('Failed to connect to MySQL on startup.', { error: err.message });
    process.exit(1);
  }

  server = app.listen(env.port, () => {
    logger.info(`Server listening on port ${env.port} [${env.nodeEnv}]`);
  });
}

process.on('unhandledRejection', (err) => {
  logger.error('UNHANDLED REJECTION! Shutting down...', { error: err.message, stack: err.stack });
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  if (server) server.close(() => logger.info('Process terminated.'));
});

start();
