const urlModel = require('../models/url.model');
const clickEventModel = require('../models/clickEvent.model');
const urlCache = require('./cache.service');
const generateShortCode = require('../utils/generateShortCode');
const { sha256 } = require('../utils/hash');
const AppError = require('../utils/AppError');
const httpStatus = require('../constants/httpStatus');
const messages = require('../constants/messages');
const env = require('../config/env');

const MAX_SHORT_CODE_COLLISION_RETRIES = 5;

function toPublicShape(row) {
  return {
    id: row.id,
    ownerType: row.owner_admin_id != null ? 'ADMIN' : 'USER',
    ownerId: row.owner_admin_id != null ? row.owner_admin_id : row.owner_user_id,
    longUrl: row.long_url,
    shortCode: row.short_code,
    shortUrl: `${env.baseUrl}/${row.short_code}`,
    clickCount: row.click_count,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
    expiresAt: row.expires_at,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at,
  };
}

async function generateUniqueShortCode() {
  for (let attempt = 0; attempt < MAX_SHORT_CODE_COLLISION_RETRIES; attempt += 1) {
    const candidate = generateShortCode();
    const existing = await urlModel.findByShortCode(candidate);
    if (!existing) return candidate;
  }
  throw new AppError('Could not generate a unique short code. Please try again.', httpStatus.INTERNAL_SERVER_ERROR);
}

async function createShortUrl({ longUrl, expiresAt }, actor) {
  const isAdmin = actor.role === 'ADMIN';
  const ownerAdminId = isAdmin ? actor.id : null;
  const ownerUserId = isAdmin ? null : actor.id;

  // Per-user daily cap — admins are uncapped. Checked before any writes so
  // a user at their limit never even reaches short-code generation.
  if (!isAdmin) {
    const todayCount = await urlModel.countTodayByOwnerUser(actor.id);
    if (todayCount >= env.url.dailyLimitPerUser) {
      throw new AppError(messages.URL.DAILY_LIMIT_REACHED, httpStatus.TOO_MANY_REQUESTS);
    }
  }

  const longUrlHash = sha256(longUrl);
  // MySQL's TIMESTAMP columns reject ISO 8601 strings ('...T...Z') under strict
  // mode — mysql2 only auto-formats real JS Date objects, so we convert here,
  // once, at the service boundary where the raw request string enters the system.
  const normalizedExpiresAt = expiresAt ? new Date(expiresAt) : null;

  // Duplicate detection: reuse an existing non-deleted short code already
  // owned by this same caller for the same long URL, instead of minting a
  // new one. Scoped per-owner (not global) — see findExistingByHash.
  const existing = await urlModel.findExistingByHash(longUrlHash, { ownerAdminId, ownerUserId });
  if (existing && !isExpired(existing)) {
    return { data: toPublicShape(existing), reused: true };
  }

  const shortCode = await generateUniqueShortCode();
  const created = await urlModel.create({
    longUrl,
    longUrlHash,
    shortCode,
    expiresAt: normalizedExpiresAt,
    ownerAdminId,
    ownerUserId,
  });
  return { data: toPublicShape(created), reused: false };
}

function isExpired(row) {
  return Boolean(row.expires_at) && new Date(row.expires_at).getTime() <= Date.now();
}

/**
 * Cache-aside resolution used by the redirect flow:
 * cache hit -> skip the database entirely.
 * cache miss -> read MySQL once, then populate the cache for next time.
 */
async function resolveShortUrl(shortCode) {
  const cached = urlCache.get(shortCode);
  if (cached) {
    if (isExpired(cached)) {
      urlCache.delete(shortCode);
      throw new AppError(messages.URL.EXPIRED, httpStatus.GONE);
    }
    return { row: cached, fromCache: true };
  }

  const row = await urlModel.findActiveByShortCode(shortCode);
  if (!row) {
    throw new AppError(messages.URL.NOT_FOUND, httpStatus.NOT_FOUND);
  }
  if (isExpired(row)) {
    throw new AppError(messages.URL.EXPIRED, httpStatus.GONE);
  }

  urlCache.put(shortCode, row);
  return { row, fromCache: false };
}

async function recordClick(shortCode, { urlId, referrer, userAgent, ipHash } = {}) {
  // Fire-and-forget from the caller's perspective: DB write + cache invalidation
  // happen after the redirect response has already been sent.
  await urlModel.incrementClick(shortCode);
  if (urlId) {
    await clickEventModel.record({ urlId, referrer, userAgent, ipHash });
  }
  const updated = await urlModel.findByShortCode(shortCode);
  if (updated && urlCache.has(shortCode)) {
    urlCache.put(shortCode, updated);
  }
}

async function updateUrl(id, longUrl) {
  const longUrlHash = sha256(longUrl);
  const updated = await urlModel.updateLongUrl(id, longUrl, longUrlHash);
  if (!updated) throw new AppError(messages.URL.NOT_FOUND, httpStatus.NOT_FOUND);
  const row = await urlModel.findById(id);
  if (row) urlCache.delete(row.short_code);
  return toPublicShape(row);
}

async function softDeleteUrl(id) {
  const deleted = await urlModel.softDelete(id);
  if (!deleted) throw new AppError(messages.URL.NOT_FOUND, httpStatus.NOT_FOUND);
  const row = await urlModel.findById(id);
  if (row) urlCache.delete(row.short_code);
  return toPublicShape(row);
}

// Ownership-checked variant of softDeleteUrl for a user deleting their own
// link. 404 (not 403) on a mismatch — same "don't reveal it exists" reasoning
// as findActiveByShortCode: a user has no legitimate reason to learn that a
// given id belongs to someone else.
async function deleteOwnUrl(userId, id) {
  const row = await urlModel.findById(id);
  if (!row || row.owner_user_id !== Number(userId)) {
    throw new AppError(messages.URL.NOT_FOUND, httpStatus.NOT_FOUND);
  }
  return softDeleteUrl(id);
}

async function restoreUrl(id) {
  const restored = await urlModel.restore(id);
  if (!restored) throw new AppError(messages.URL.NOT_FOUND, httpStatus.NOT_FOUND);
  const row = await urlModel.findById(id);
  return toPublicShape(row);
}

async function listUrls(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const { rows, total } = await urlModel.list({
    limit,
    offset,
    search: query.search || '',
    sortBy: query.sortBy || 'created_at',
    sortOrder: query.sortOrder || 'desc',
    includeDeleted: query.includeDeleted === 'true',
  });

  return {
    data: rows.map(toPublicShape),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

async function listMyUrls(userId, query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const { rows, total } = await urlModel.listByOwnerUser(userId, { limit, offset });

  return {
    data: rows.map(toPublicShape),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

module.exports = {
  createShortUrl,
  resolveShortUrl,
  recordClick,
  softDeleteUrl,
  deleteOwnUrl,
  restoreUrl,
  listUrls,
  listMyUrls,
  toPublicShape,
  isExpired,
};
