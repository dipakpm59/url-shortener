/**
 * O(1) LFU (Least Frequently Used) Cache.
 *
 * Structure:
 *  - keyNode:  Map<key, Node>                 -> O(1) lookup of any entry
 *  - freqMap:  Map<frequency, Map<key, Node>> -> all keys at a given frequency,
 *              stored in a Map so insertion order gives LRU-within-frequency
 *              ordering for free (used as the eviction tie-breaker).
 *  - minFreq:  the lowest frequency currently present, so eviction never
 *              has to scan for the minimum.
 */

class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.freq = 1;
  }
}

class LFUCache {
  constructor(capacity) {
    if (capacity <= 0) throw new Error('LFUCache capacity must be a positive integer.');
    this.capacity = capacity;
    this.count = 0;
    this.minFreq = 0;

    this.keyNode = new Map();
    this.freqMap = new Map();

    this.stats = { hits: 0, misses: 0, evictions: 0, puts: 0 };
  }

  _addToFreqBucket(node) {
    if (!this.freqMap.has(node.freq)) this.freqMap.set(node.freq, new Map());
    this.freqMap.get(node.freq).set(node.key, node);
  }

  _removeFromFreqBucket(node) {
    const bucket = this.freqMap.get(node.freq);
    bucket.delete(node.key);
    if (bucket.size === 0) {
      this.freqMap.delete(node.freq);
      if (this.minFreq === node.freq) this.minFreq += 1;
    }
  }

  /** Bumps a key's frequency by 1 and moves it to the next frequency bucket. */
  updateFrequency(key) {
    const node = this.keyNode.get(key);
    if (!node) return false;
    this._removeFromFreqBucket(node);
    node.freq += 1;
    this._addToFreqBucket(node);
    return true;
  }

  get(key) {
    const node = this.keyNode.get(key);
    if (!node) {
      this.stats.misses += 1;
      return undefined;
    }
    this.updateFrequency(key);
    this.stats.hits += 1;
    return node.value;
  }

  put(key, value) {
    if (this.capacity <= 0) return;
    this.stats.puts += 1;

    if (this.keyNode.has(key)) {
      const node = this.keyNode.get(key);
      node.value = value;
      this.updateFrequency(key);
      return;
    }

    if (this.count >= this.capacity) {
      this.eviction();
    }

    const node = new Node(key, value);
    this.keyNode.set(key, node);
    this._addToFreqBucket(node);
    this.minFreq = 1;
    this.count += 1;
  }

  /** Evicts the least-frequently-used key (ties broken by least-recently-used). */
  eviction() {
    const bucket = this.freqMap.get(this.minFreq);
    if (!bucket || bucket.size === 0) return null;

    const evictedKey = bucket.keys().next().value;
    bucket.delete(evictedKey);
    if (bucket.size === 0) this.freqMap.delete(this.minFreq);

    this.keyNode.delete(evictedKey);
    this.count -= 1;
    this.stats.evictions += 1;
    return evictedKey;
  }

  delete(key) {
    const node = this.keyNode.get(key);
    if (!node) return false;
    this._removeFromFreqBucket(node);
    this.keyNode.delete(key);
    this.count -= 1;
    if (this.count === 0) this.minFreq = 0;
    return true;
  }

  has(key) {
    return this.keyNode.has(key);
  }

  size() {
    return this.count;
  }

  clear() {
    this.keyNode.clear();
    this.freqMap.clear();
    this.minFreq = 0;
    this.count = 0;
  }

  statistics() {
    const total = this.stats.hits + this.stats.misses;
    return {
      capacity: this.capacity,
      size: this.count,
      minFrequency: this.minFreq,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total === 0 ? 0 : Number(((this.stats.hits / total) * 100).toFixed(2)),
      evictions: this.stats.evictions,
      puts: this.stats.puts,
    };
  }
}

module.exports = LFUCache;
