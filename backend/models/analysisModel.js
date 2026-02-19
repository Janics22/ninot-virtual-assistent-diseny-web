const pool = require('../db');

class AnalysisModel {
  static async create(userId, url, summary) {
    const result = await pool.query(
      'INSERT INTO analysis_history (user_id, url, summary) VALUES ($1, $2, $3) RETURNING *',
      [userId, url, JSON.stringify(summary)]
    );
    return result.rows[0];
  }

  static async findByUserId(userId, limit = 50) {
    const result = await pool.query(
      'SELECT * FROM analysis_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit]
    );
    return result.rows;
  }

  static async getMonthlyCount(userId) {
    const result = await pool.query(
      `SELECT COUNT(*) as count 
       FROM analysis_history 
       WHERE user_id = $1 
       AND created_at >= NOW() - INTERVAL '30 days'`,
      [userId]
    );
    return parseInt(result.rows[0].count);
  }
}

module.exports = AnalysisModel;