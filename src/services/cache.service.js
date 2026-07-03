const LFUCache = require('../cache/LFUCache');
const env = require('../config/env');

// Single shared cache instance for the whole process: short_code -> url row data.
const urlCache = new LFUCache(env.cache.capacity);

module.exports = urlCache;
