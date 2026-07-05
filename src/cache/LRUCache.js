/**
 * O(1) LRU (Least Recently Used) Cache.
 *
 * Structure:
 *  - map:  Map<key, Node> -> O(1) lookup of any entry
 *  - a doubly linked list threading every Node together in recency order:
 *      head <-> (most recently used) ... (least recently used) <-> tail
 *    Sentinel head/tail nodes remove edge-case branching for an empty list
 *    or a single-node list — every real node always has a real prev/next.
 *  - get() and a put() on an existing key move that node to the front
 *    (most-recently-used end). Eviction always removes tail.prev (the
 *    least-recently-used end) — no scanning, no frequency tracking.
 */

class Node {
  constructor(key, value) {
    this.key = key;
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    if (capacity <= 0) throw new Error('LRUCache capacity must be a positive integer.');
    this.capacity = capacity;
    this.count = 0;
    this.map = new Map();

    this.head = new Node(null, null);
    this.tail = new Node(null, null);
    this.head.next = this.tail;
    this.tail.prev = this.head;

    this.stats = { hits: 0, misses: 0, evictions: 0, puts: 0 };
  }

  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _addToFront(node) {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }

  _moveToFront(node) {
    this._remove(node);
    this._addToFront(node);
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) {
      this.stats.misses += 1;
      return undefined;
    }
    this._moveToFront(node);
    this.stats.hits += 1;
    return node.value;
  }

  put(key, value) {
    if (this.capacity <= 0) return;
    this.stats.puts += 1;

    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this._moveToFront(existing);
      return;
    }

    if (this.count >= this.capacity) {
      this.eviction();
    }

    const node = new Node(key, value);
    this.map.set(key, node);
    this._addToFront(node);
    this.count += 1;
  }

  /** Evicts the least-recently-used key — always tail.prev, no scanning. */
  eviction() {
    const lru = this.tail.prev;
    if (lru === this.head) return null;

    this._remove(lru);
    this.map.delete(lru.key);
    this.count -= 1;
    this.stats.evictions += 1;
    return lru.key;
  }

  delete(key) {
    const node = this.map.get(key);
    if (!node) return false;
    this._remove(node);
    this.map.delete(key);
    this.count -= 1;
    return true;
  }

  has(key) {
    return this.map.has(key);
  }

  size() {
    return this.count;
  }

  clear() {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.count = 0;
  }

  statistics() {
    const total = this.stats.hits + this.stats.misses;
    return {
      capacity: this.capacity,
      size: this.count,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total === 0 ? 0 : Number(((this.stats.hits / total) * 100).toFixed(2)),
      evictions: this.stats.evictions,
      puts: this.stats.puts,
    };
  }
}

module.exports = LRUCache;
