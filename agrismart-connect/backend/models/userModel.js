// ============================================================
// User Model
// All raw, parameterized SQL for the users/farmers/customers tables.
// ============================================================
const pool = require('../config/db');

const UserModel = {
  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = :email LIMIT 1', { email });
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = :id LIMIT 1', { id });
    return rows[0] || null;
  },

  async createUser({ fullName, email, phone, passwordHash, role }) {
    const [result] = await pool.query(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES (:fullName, :email, :phone, :passwordHash, :role)`,
      { fullName, email, phone, passwordHash, role }
    );
    return result.insertId;
  },

  async updateLastLogin(userId) {
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = :userId', { userId });
  },

  async setResetToken(userId, token, expires) {
    await pool.query(
      'UPDATE users SET reset_token = :token, reset_token_expires = :expires WHERE id = :userId',
      { userId, token, expires }
    );
  },

  async findByResetToken(token) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE reset_token = :token AND reset_token_expires > NOW() LIMIT 1',
      { token }
    );
    return rows[0] || null;
  },

  async updatePassword(userId, passwordHash) {
    await pool.query(
      'UPDATE users SET password_hash = :passwordHash, reset_token = NULL, reset_token_expires = NULL WHERE id = :userId',
      { userId, passwordHash }
    );
  },

  // -------------------- Farmer profile --------------------
  async createFarmerProfile(userId, { location, district, state, farmArea, farmerType }) {
    const [result] = await pool.query(
      `INSERT INTO farmers (user_id, location, district, state, farm_area, farmer_type)
       VALUES (:userId, :location, :district, :state, :farmArea, :farmerType)`,
      { userId, location, district, state, farmArea, farmerType }
    );
    return result.insertId;
  },

  async findFarmerByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT f.*, u.full_name, u.email, u.phone, u.status
       FROM farmers f JOIN users u ON u.id = f.user_id
       WHERE f.user_id = :userId LIMIT 1`,
      { userId }
    );
    return rows[0] || null;
  },

  // -------------------- Customer profile --------------------
  async createCustomerProfile(userId, { location, address }) {
    const [result] = await pool.query(
      `INSERT INTO customers (user_id, location, address) VALUES (:userId, :location, :address)`,
      { userId, location, address }
    );
    return result.insertId;
  },

  async findCustomerByUserId(userId) {
    const [rows] = await pool.query(
      `SELECT c.*, u.full_name, u.email, u.phone, u.status
       FROM customers c JOIN users u ON u.id = c.user_id
       WHERE c.user_id = :userId LIMIT 1`,
      { userId }
    );
    return rows[0] || null;
  }
};

module.exports = UserModel;
