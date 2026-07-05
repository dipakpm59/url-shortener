const { pool } = require('../config/db');

const urlModel = {
  async create({ longUrl, longUrlHash, shortCode, expiresAt, ownerAdminId, ownerUserId }) {
    const [result] = await pool.query(
      `INSERT INTO urls (owner_admin_id, owner_user_id, long_url, long_url_hash, short_code, expires_at)
       VALUES (:ownerAdminId, :ownerUserId, :longUrl, :longUrlHash, :shortCode, :expiresAt)`,
      { ownerAdminId: ownerAdminId ?? null, ownerUserId: ownerUserId ?? null, longUrl, longUrlHash, shortCode, expiresAt }
    );
    return this.findById(result.insertId);
  },

  async findByShortCode(shortCode) {
    const [rows] = await pool.query(
      `SELECT * FROM urls WHERE short_code = :shortCode LIMIT 1`,
      { shortCode }
    );
    return rows[0] || null;
  },

  async findActiveByShortCode(shortCode) {
    const [rows] = await pool.query(
      `SELECT * FROM urls
       WHERE short_code = :shortCode AND is_deleted = FALSE
       LIMIT 1`,
      { shortCode }
    );
    return rows[0] || null;
  },

  // Scoped to the same owner — now that urls are owned, "have I already
  // shortened this URL" must mean the same caller, not anyone globally.
  // Otherwise one user's link could get silently reused/returned to a
  // different user who submits the same long URL, handing them a short
  // code they don't own and that won't appear in their own url list.
  async findExistingByHash(longUrlHash, { ownerAdminId, ownerUserId }) {
    const ownerColumn = ownerAdminId != null ? 'owner_admin_id' : 'owner_user_id';
    const ownerId = ownerAdminId != null ? ownerAdminId : ownerUserId;
    const [rows] = await pool.query(
      `SELECT * FROM urls
       WHERE long_url_hash = :longUrlHash
         AND ${ownerColumn} = :ownerId
         AND is_deleted = FALSE
       LIMIT 1`,
      { longUrlHash, ownerId }
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM urls WHERE id = :id LIMIT 1`, { id });
    return rows[0] || null;
  },

  async incrementClick(shortCode) {
    await pool.query(
      `UPDATE urls
       SET click_count = click_count + 1, last_accessed_at = NOW()
       WHERE short_code = :shortCode`,
      { shortCode }
    );
  },

  async softDelete(id) {
    const [result] = await pool.query(
      `UPDATE urls SET is_deleted = TRUE, deleted_at = NOW()
       WHERE id = :id AND is_deleted = FALSE`,
      { id }
    );
    return result.affectedRows > 0;
  },

  async restore(id) {
    const [result] = await pool.query(
      `UPDATE urls SET is_deleted = FALSE, deleted_at = NULL
       WHERE id = :id AND is_deleted = TRUE`,
      { id }
    );
    return result.affectedRows > 0;
  },

  async updateLongUrl(id, longUrl, longUrlHash) {
    const [result] = await pool.query(
      `UPDATE urls SET long_url = :longUrl, long_url_hash = :longUrlHash WHERE id = :id`,
      { id, longUrl, longUrlHash }
    );
    return result.affectedRows > 0;
  },

  async list({ limit, offset, search, sortBy, sortOrder, includeDeleted }) {
    const where = includeDeleted ? '' : 'WHERE is_deleted = FALSE';
    const searchClause = search
      ? `${where ? 'AND' : 'WHERE'} (long_url LIKE :search OR short_code LIKE :search)`
      : '';
    const allowedSort = ['created_at', 'click_count', 'last_accessed_at', 'expires_at'];
    const column = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [rows] = await pool.query(
      `SELECT * FROM urls ${where} ${searchClause}
       ORDER BY ${column} ${order}
       LIMIT :limit OFFSET :offset`,
      { search: `%${search}%`, limit, offset }
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM urls ${where} ${searchClause}`,
      { search: `%${search}%` }
    );

    return { rows, total };
  },

  async countAll() {
    const [[row]] = await pool.query(
      `SELECT
         COUNT(*) AS totalUrls,
         SUM(click_count) AS totalClicks,
         SUM(CASE WHEN is_deleted THEN 1 ELSE 0 END) AS deletedUrls,
         SUM(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 ELSE 0 END) AS expiredUrls
       FROM urls`
    );
    return row;
  },

  async mostClicked(limit = 10) {
    const [rows] = await pool.query(
      `SELECT short_code, long_url, click_count, created_at
       FROM urls
       WHERE is_deleted = FALSE
       ORDER BY click_count DESC
       LIMIT :limit`,
      { limit }
    );
    return rows;
  },

  // Backs the per-user daily creation cap. idx_owner_user_created makes
  // this an index range scan rather than a table scan.
  async countTodayByOwnerUser(userId) {
    const [[{ count }]] = await pool.query(
      `SELECT COUNT(*) AS count FROM urls
       WHERE owner_user_id = :userId AND created_at >= CURDATE()`,
      { userId }
    );
    return count;
  },

  async listByOwnerUser(userId, { limit, offset }) {
    const [rows] = await pool.query(
      `SELECT * FROM urls
       WHERE owner_user_id = :userId
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      { userId, limit, offset }
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM urls WHERE owner_user_id = :userId`,
      { userId }
    );
    return { rows, total };
  },

  // Same shape as countAll(), scoped to one user's own links.
  async countAllByOwnerUser(userId) {
    const [[row]] = await pool.query(
      `SELECT
         COUNT(*) AS totalUrls,
         SUM(click_count) AS totalClicks,
         SUM(CASE WHEN is_deleted THEN 1 ELSE 0 END) AS deletedUrls,
         SUM(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 ELSE 0 END) AS expiredUrls
       FROM urls WHERE owner_user_id = :userId`,
      { userId }
    );
    return row;
  },

  async mostClickedByOwnerUser(userId, limit = 10) {
    const [rows] = await pool.query(
      `SELECT short_code, long_url, click_count, created_at
       FROM urls
       WHERE owner_user_id = :userId AND is_deleted = FALSE
       ORDER BY click_count DESC
       LIMIT :limit`,
      { userId, limit }
    );
    return rows;
  },
};

module.exports = urlModel;
