process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const urlModel = require('../src/models/url.model');
const clickEventModel = require('../src/models/clickEvent.model');
const urlCache = require('../src/services/cache.service');
const urlService = require('../src/services/url.service');
const env = require('../src/config/env');

function makeUrlRow(overrides = {}) {
  return {
    id: 1,
    owner_admin_id: null,
    owner_user_id: 7,
    long_url: 'https://example.com',
    long_url_hash: 'hash',
    short_code: 'abc1234567',
    click_count: 0,
    created_at: new Date(),
    last_accessed_at: null,
    expires_at: null,
    is_deleted: false,
    deleted_at: null,
    ...overrides,
  };
}

// The cache is a process-wide singleton shared by url.service — clear it
// between tests so cached entries from one test don't leak into the next.
beforeEach(() => {
  urlCache.clear();
});

// --- createShortUrl: per-user daily limit ---

test('createShortUrl blocks a USER who has hit the daily limit, before checking for duplicates', async (t) => {
  const countToday = t.mock.method(urlModel, 'countTodayByOwnerUser', async () => env.url.dailyLimitPerUser);
  const findExisting = t.mock.method(urlModel, 'findExistingByHash', async () => null);

  await assert.rejects(
    () => urlService.createShortUrl({ longUrl: 'https://example.com' }, { id: 7, role: 'USER' }),
    (err) => {
      assert.equal(err.statusCode, 429);
      return true;
    }
  );
  assert.equal(countToday.mock.calls.length, 1);
  assert.equal(findExisting.mock.calls.length, 0, 'should bail before even checking for a duplicate');
});

test('createShortUrl never checks the daily limit for an ADMIN actor', async (t) => {
  const countToday = t.mock.method(urlModel, 'countTodayByOwnerUser', async () => 9999);
  t.mock.method(urlModel, 'findExistingByHash', async () => null);
  t.mock.method(urlModel, 'findByShortCode', async () => null);
  t.mock.method(urlModel, 'create', async () => makeUrlRow({ owner_admin_id: 1, owner_user_id: null }));

  const { data } = await urlService.createShortUrl({ longUrl: 'https://example.com' }, { id: 1, role: 'ADMIN' });

  assert.equal(countToday.mock.calls.length, 0);
  assert.equal(data.ownerType, 'ADMIN');
});

// --- createShortUrl: duplicate detection ---

test('createShortUrl reuses an existing non-expired link owned by the same caller', async (t) => {
  t.mock.method(urlModel, 'countTodayByOwnerUser', async () => 0);
  t.mock.method(urlModel, 'findExistingByHash', async () => makeUrlRow());
  const create = t.mock.method(urlModel, 'create', async () => { throw new Error('should not be called'); });

  const { data, reused } = await urlService.createShortUrl({ longUrl: 'https://example.com' }, { id: 7, role: 'USER' });

  assert.equal(reused, true);
  assert.equal(create.mock.calls.length, 0);
  assert.equal(data.shortCode, 'abc1234567');
});

test('createShortUrl mints a new code when the existing match is expired', async (t) => {
  t.mock.method(urlModel, 'countTodayByOwnerUser', async () => 0);
  t.mock.method(urlModel, 'findExistingByHash', async () => makeUrlRow({ expires_at: new Date(Date.now() - 1000) }));
  t.mock.method(urlModel, 'findByShortCode', async () => null);
  const create = t.mock.method(urlModel, 'create', async () => makeUrlRow({ short_code: 'newcode123' }));

  const { data, reused } = await urlService.createShortUrl({ longUrl: 'https://example.com' }, { id: 7, role: 'USER' });

  assert.equal(reused, false);
  assert.equal(create.mock.calls.length, 1);
  assert.equal(data.shortCode, 'newcode123');
});

test('createShortUrl retries short-code generation on a collision', async (t) => {
  t.mock.method(urlModel, 'countTodayByOwnerUser', async () => 0);
  t.mock.method(urlModel, 'findExistingByHash', async () => null);
  let calls = 0;
  const findByShortCode = t.mock.method(urlModel, 'findByShortCode', async () => {
    calls += 1;
    return calls === 1 ? makeUrlRow() : null; // first generated candidate "taken", second is free
  });
  t.mock.method(urlModel, 'create', async () => makeUrlRow({ short_code: 'freecode12' }));

  const { data } = await urlService.createShortUrl({ longUrl: 'https://example.com' }, { id: 7, role: 'USER' });

  assert.equal(findByShortCode.mock.calls.length, 2);
  assert.equal(data.shortCode, 'freecode12');
});

// --- resolveShortUrl: cache-aside redirect path ---

test('resolveShortUrl serves a cache hit without touching the database', async (t) => {
  urlCache.put('cached123', makeUrlRow({ short_code: 'cached123' }));
  const findActive = t.mock.method(urlModel, 'findActiveByShortCode', async () => { throw new Error('should not be called'); });

  const { row, fromCache } = await urlService.resolveShortUrl('cached123');

  assert.equal(fromCache, true);
  assert.equal(row.short_code, 'cached123');
  assert.equal(findActive.mock.calls.length, 0);
});

test('resolveShortUrl evicts an expired cache entry and reports 410 Gone', async (t) => {
  urlCache.put('expired1', makeUrlRow({ short_code: 'expired1', expires_at: new Date(Date.now() - 1000) }));

  await assert.rejects(
    () => urlService.resolveShortUrl('expired1'),
    (err) => {
      assert.equal(err.statusCode, 410);
      return true;
    }
  );
  assert.equal(urlCache.has('expired1'), false);
});

test('resolveShortUrl falls back to the database on a cache miss and populates the cache', async (t) => {
  const findActive = t.mock.method(urlModel, 'findActiveByShortCode', async () => makeUrlRow({ short_code: 'fresh123' }));

  const { row, fromCache } = await urlService.resolveShortUrl('fresh123');

  assert.equal(fromCache, false);
  assert.equal(row.short_code, 'fresh123');
  assert.equal(findActive.mock.calls.length, 1);
  assert.equal(urlCache.has('fresh123'), true, 'a fresh DB hit should populate the cache for next time');
});

test('resolveShortUrl throws 404 for a short code that does not exist', async (t) => {
  t.mock.method(urlModel, 'findActiveByShortCode', async () => null);

  await assert.rejects(
    () => urlService.resolveShortUrl('missing1'),
    (err) => {
      assert.equal(err.statusCode, 404);
      return true;
    }
  );
});

test('resolveShortUrl throws 410 for an expired row from the database, without caching it', async (t) => {
  t.mock.method(urlModel, 'findActiveByShortCode', async () =>
    makeUrlRow({ short_code: 'expdb123', expires_at: new Date(Date.now() - 1000) })
  );

  await assert.rejects(
    () => urlService.resolveShortUrl('expdb123'),
    (err) => {
      assert.equal(err.statusCode, 410);
      return true;
    }
  );
  assert.equal(urlCache.has('expdb123'), false);
});

// --- recordClick ---

test('recordClick does not cache a short code nothing had previously requested', async (t) => {
  t.mock.method(urlModel, 'incrementClick', async () => {});
  t.mock.method(clickEventModel, 'record', async () => {});
  t.mock.method(urlModel, 'findByShortCode', async () => makeUrlRow({ short_code: 'notcached', click_count: 1 }));

  await urlService.recordClick('notcached', { urlId: 1 });

  assert.equal(urlCache.has('notcached'), false);
});

test('recordClick refreshes an already-cached entry with the new click count', async (t) => {
  urlCache.put('cachedhit', makeUrlRow({ short_code: 'cachedhit', click_count: 0 }));
  t.mock.method(urlModel, 'incrementClick', async () => {});
  t.mock.method(clickEventModel, 'record', async () => {});
  t.mock.method(urlModel, 'findByShortCode', async () => makeUrlRow({ short_code: 'cachedhit', click_count: 1 }));

  await urlService.recordClick('cachedhit', { urlId: 1 });

  assert.equal(urlCache.get('cachedhit').click_count, 1);
});
