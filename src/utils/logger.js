const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const streams = {
  app: fs.createWriteStream(path.join(LOG_DIR, 'app.log'), { flags: 'a' }),
  error: fs.createWriteStream(path.join(LOG_DIR, 'error.log'), { flags: 'a' }),
  request: fs.createWriteStream(path.join(LOG_DIR, 'request.log'), { flags: 'a' }),
};

function write(stream, level, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta } : {}),
  };
  const line = JSON.stringify(entry) + '\n';
  streams[stream].write(line);
  if (!module.exports.isTest) {
    (level === 'error' ? console.error : console.log)(`[${entry.timestamp}] ${level.toUpperCase()}: ${message}`);
  }
}

module.exports = {
  isTest: process.env.NODE_ENV === 'test',
  info: (message, meta) => write('app', 'info', message, meta),
  warn: (message, meta) => write('app', 'warn', message, meta),
  error: (message, meta) => write('error', 'error', message, meta),
  requestStream: streams.request,
};
