const { pool } = require('../config/db');

const userModel = {
  async findByEmail(email) {
    const [rows] = await pool.query(`SELECT * FROM users WHERE email = :email LIMIT 1`, { email });
    return rows[0] || null;
  },

  async findByUsername(username) {
    const [rows] = await pool.query(`SELECT * FROM users WHERE username = :username LIMIT 1`, { username });
    return rows[0] || null;
  },

  async findByEmailOrUsername(identifier) {
    const [rows] = await pool.query(
      `SELECT * FROM users WHERE email = :identifier OR username = :identifier LIMIT 1`,
      { identifier }
    );
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM users WHERE id = :id LIMIT 1`, { id });
    return rows[0] || null;
  },

  async create({ username, email, passwordHash }) {
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash) VALUES (:username, :email, :passwordHash)`,
      { username, email, passwordHash }
    );
    return this.findById(result.insertId);
  },

  async incrementFailedAttempts(id) {
    await pool.query(
      `UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = :id`,
      { id }
    );
  },

  async lockAccount(id, lockedUntil) {
    await pool.query(
      `UPDATE users SET locked_until = :lockedUntil WHERE id = :id`,
      { id, lockedUntil }
    );
  },

  async resetFailedAttempts(id) {
    await pool.query(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = :id`,
      { id }
    );
  },

  async updatePasswordHash(id, passwordHash) {
    await pool.query(
      `UPDATE users SET password_hash = :passwordHash WHERE id = :id`,
      { id, passwordHash }
    );
  },

  async list({ limit, offset, search }) {
    const searchClause = search ? 'WHERE username LIKE :search OR email LIKE :search' : '';
    const [rows] = await pool.query(
      `SELECT * FROM users ${searchClause} ORDER BY created_at DESC LIMIT :limit OFFSET :offset`,
      { search: `%${search}%`, limit, offset }
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${searchClause}`,
      { search: `%${search}%` }
    );
    return { rows, total };
  },

  async setActive(id, isActive) {
    const [result] = await pool.query(
      `UPDATE users SET is_active = :isActive WHERE id = :id`,
      { id, isActive }
    );
    return result.affectedRows > 0;
  },

  async deleteById(id) {
    // ON DELETE CASCADE on urls.owner_user_id means this also removes every
    // url this user owns — intentional: "delete user" is a distinct, more
    // final action than "disable" (setActive), which is the non-destructive
    // option for deactivating an account without losing their data.
    const [result] = await pool.query(`DELETE FROM users WHERE id = :id`, { id });
    return result.affectedRows > 0;
  },
};

module.exports = userModel;
