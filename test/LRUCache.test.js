const test = require('node:test');
const assert = require('node:assert/strict');
const LRUCache = require('../src/cache/LRUCache');

test('cache miss on an empty cache', () => {
  const cache = new LRUCache(2);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.statistics().misses, 1);
  assert.equal(cache.statistics().hits, 0);
});

test('cache hit returns the stored value', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.statistics().hits, 1);
  assert.equal(cache.statistics().misses, 0);
});

test('put on an existing key updates the value without growing size', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('a', 2);
  assert.equal(cache.get('a'), 2);
  assert.equal(cache.size(), 1);
});

test('evicts the least-recently-used key when capacity is exceeded', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.put('c', 3); // capacity 2, full -> evicts 'a' (never touched since insert)

  assert.equal(cache.has('a'), false);
  assert.equal(cache.get('b'), 2);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.statistics().evictions, 1);
});

test('get() marks a key as recently used, protecting it from eviction', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.get('a'); // 'a' is now more recently used than 'b'
  cache.put('c', 3); // should evict 'b', not 'a'

  assert.equal(cache.has('a'), true);
  assert.equal(cache.has('b'), false);
  assert.equal(cache.has('c'), true);
});

test('correct behavior after eviction: cache still works normally', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.put('c', 3); // evicts 'a'

  // Cache should still be fully functional post-eviction: further puts/gets
  // work, size stays capped, and re-inserting the evicted key works cleanly.
  cache.put('a', 10);
  assert.equal(cache.size(), 2);
  assert.equal(cache.has('b'), false); // 'b' was the LRU at this point, evicted
  assert.equal(cache.get('a'), 10);
  assert.equal(cache.get('c'), 3);
});

test('delete() removes a key and frees exactly one slot of capacity', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('b', 2);

  assert.equal(cache.delete('a'), true);
  assert.equal(cache.has('a'), false);
  assert.equal(cache.size(), 1);

  // Capacity 2, one item ('b') present after the delete -> exactly one more
  // item fits before eviction is needed again.
  cache.put('c', 3);
  assert.equal(cache.statistics().evictions, 0);
  assert.equal(cache.has('b'), true);
  assert.equal(cache.has('c'), true);
});

test('clear() empties the cache completely', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.put('b', 2);
  cache.clear();

  assert.equal(cache.size(), 0);
  assert.equal(cache.has('a'), false);
  assert.equal(cache.get('a'), undefined);
});

test('statistics() reports a correct hit rate', () => {
  const cache = new LRUCache(2);
  cache.put('a', 1);
  cache.get('a'); // hit
  cache.get('z'); // miss

  const stats = cache.statistics();
  assert.equal(stats.hits, 1);
  assert.equal(stats.misses, 1);
  assert.equal(stats.hitRate, 50);
});
