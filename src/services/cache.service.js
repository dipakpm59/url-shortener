const LRUCache = require('../cache/LRUCache');
const env = require('../config/env');

// Single shared cache instance for the whole process: short_code -> url row data.
const urlCache = new LRUCache(env.cache.capacity);

module.exports = urlCache;
