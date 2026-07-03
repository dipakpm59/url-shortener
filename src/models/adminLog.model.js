const { pool } = require('../config/db');

const adminLogModel = {
  async record({ adminId, action, details, ipAddress, userAgent }) {
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, details, ip_address, user_agent)
       VALUES (:adminId, :action, :details, :ipAddress, :userAgent)`,
      { adminId: adminId || null, action, details: details || null, ipAddress: ipAddress || null, userAgent: userAgent || null }
    );
  },

  async listRecent(limit = 50) {
    const [rows] = await pool.query(
      `SELECT al.*, a.username
       FROM admin_logs al
       LEFT JOIN admins a ON a.id = al.admin_id
       ORDER BY al.created_at DESC
       LIMIT :limit`,
      { limit }
    );
    return rows;
  },
};

module.exports = adminLogModel;
