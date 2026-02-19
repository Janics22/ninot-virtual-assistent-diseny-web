const pool = require('../db');

class UserModel {
  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT id, email, plan, stripe_customer_id, analyses_count, current_period_end FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async create(email, passwordHash) {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, plan, current_period_end) 
       VALUES ($1, $2, 'free', NOW() + INTERVAL '30 days') 
       RETURNING id, email, plan`,
      [email, passwordHash]
    );
    return result.rows[0];
  }

  static async updateStripeCustomer(userId, customerId) {
    await pool.query(
      'UPDATE users SET stripe_customer_id = $1 WHERE id = $2',
      [customerId, userId]
    );
  }

  static async updatePlan(userId, plan, subscriptionId = null) {
    const query = subscriptionId
      ? 'UPDATE users SET plan = $1, stripe_subscription_id = $2, current_period_end = NOW() + INTERVAL \'30 days\', analyses_count = 0 WHERE id = $3'
      : 'UPDATE users SET plan = $1, current_period_end = NOW() + INTERVAL \'30 days\', analyses_count = 0 WHERE id = $2';
    
    const params = subscriptionId 
      ? [plan, subscriptionId, userId]
      : [plan, userId];
    
    await pool.query(query, params);
  }

  static async incrementAnalysisCount(userId) {
    await pool.query(
      'UPDATE users SET analyses_count = analyses_count + 1 WHERE id = $1',
      [userId]
    );
  }

  static async resetAnalysisCount(userId) {
    await pool.query(
      'UPDATE users SET analyses_count = 0, current_period_end = NOW() + INTERVAL \'30 days\' WHERE id = $1',
      [userId]
    );
  }

  static async findByStripeCustomer(customerId) {
    const result = await pool.query(
      'SELECT * FROM users WHERE stripe_customer_id = $1',
      [customerId]
    );
    return result.rows[0];
  }
}

module.exports = UserModel;