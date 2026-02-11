const pool = require('../db');

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'free',
        stripe_customer_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
    `);

    console.log('✅ Base de datos inicializada correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar base de datos:', error);
    process.exit(1);
  }
}

initDatabase();
