// ============================================================
// MySQL Connection Pool
// Uses mysql2/promise so controllers can use async/await
// with parameterized queries (SQL injection prevention).
// ============================================================
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'agrismart_connect',
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  queueLimit: 0,
  namedPlaceholders: true,
  dateStrings: true
});

// Quick startup check so failures are obvious instead of silent.
async function verifyConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected:', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Check your .env DB_* values and that MySQL is running.');
  }
}

verifyConnection();

module.exports = pool;
