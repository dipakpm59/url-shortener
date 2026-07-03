const { pool } = require('../config/db');

const adminModel = {
  async findByEmail(email) {
    const [rows] = await pool.query(`SELECT * FROM admins WHERE email = :email LIMIT 1`, { email });
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query(`SELECT * FROM admins WHERE id = :id LIMIT 1`, { id });
    return rows[0] || null;
  },

  async create({ username, email, passwordHash }) {
    const [result] = await pool.query(
      `INSERT INTO admins (username, email, password_hash) VALUES (:username, :email, :passwordHash)`,
      { username, email, passwordHash }
    );
    return this.findById(result.insertId);
  },

  async incrementFailedAttempts(id) {
    await pool.query(
      `UPDATE admins SET failed_attempts = failed_attempts + 1 WHERE id = :id`,
      { id }
    );
  },

  async lockAccount(id, lockedUntil) {
    await pool.query(
      `UPDATE admins SET locked_until = :lockedUntil WHERE id = :id`,
      { id, lockedUntil }
    );
  },

  async resetFailedAttempts(id) {
    await pool.query(
      `UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = :id`,
      { id }
    );
  },

  async updatePasswordHash(id, passwordHash) {
    await pool.query(
      `UPDATE admins SET password_hash = :passwordHash WHERE id = :id`,
      { id, passwordHash }
    );
  },

  async setResetOtp(id, otpHash, expiresAt) {
    await pool.query(
      `UPDATE admins SET reset_otp_hash = :otpHash, reset_otp_expires = :expiresAt WHERE id = :id`,
      { id, otpHash, expiresAt }
    );
  },

  async clearResetOtp(id) {
    await pool.query(
      `UPDATE admins SET reset_otp_hash = NULL, reset_otp_expires = NULL WHERE id = :id`,
      { id }
    );
  },
};

module.exports = adminModel;
