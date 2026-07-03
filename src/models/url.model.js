const { pool } = require('../config/db');

const urlModel = {
  async create({ longUrl, longUrlHash, shortCode, isCustomAlias, expiresAt }) {
    const [result] = await pool.query(
      `INSERT INTO urls (long_url, long_url_hash, short_code, is_custom_alias, expires_at)
       VALUES (:longUrl, :longUrlHash, :shortCode, :isCustomAlias, :expiresAt)`,
      { longUrl, longUrlHash, shortCode, isCustomAlias, expiresAt }
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

  async findExistingByHash(longUrlHash) {
    const [rows] = await pool.query(
      `SELECT * FROM urls
       WHERE long_url_hash = :longUrlHash
         AND is_custom_alias = FALSE
         AND is_deleted = FALSE
       LIMIT 1`,
      { longUrlHash }
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
};

module.exports = urlModel;
