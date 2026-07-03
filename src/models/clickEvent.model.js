const { pool } = require('../config/db');

const clickEventModel = {
  async record({ urlId, referrer, userAgent, ipHash }) {
    await pool.query(
      `INSERT INTO click_events (url_id, referrer, user_agent, ip_hash)
       VALUES (:urlId, :referrer, :userAgent, :ipHash)`,
      { urlId, referrer: referrer || null, userAgent: userAgent || null, ipHash: ipHash || null }
    );
  },

  /** Daily click counts for the last N days, for the "clicks over time" chart. */
  async clicksOverTime(days = 14) {
    const [rows] = await pool.query(
      `SELECT DATE(clicked_at) AS date, COUNT(*) AS clicks
       FROM click_events
       WHERE clicked_at >= DATE_SUB(CURDATE(), INTERVAL :days DAY)
       GROUP BY DATE(clicked_at)
       ORDER BY date ASC`,
      { days }
    );
    return rows;
  },
};

module.exports = clickEventModel;
