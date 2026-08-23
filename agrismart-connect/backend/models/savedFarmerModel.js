// ============================================================
// Saved Farmers (Customer Favorites) Model -> section 12
// ============================================================
const pool = require('../config/db');

const SavedFarmerModel = {
  async add(customerId, farmerId) {
    await pool.query(
      'INSERT IGNORE INTO saved_farmers (customer_id, farmer_id) VALUES (:customerId, :farmerId)',
      { customerId, farmerId }
    );
  },

  async remove(customerId, farmerId) {
    await pool.query(
      'DELETE FROM saved_farmers WHERE customer_id = :customerId AND farmer_id = :farmerId',
      { customerId, farmerId }
    );
  },

  async findAllByCustomer(customerId) {
    const [rows] = await pool.query(
      `SELECT sf.id AS saved_id, f.id AS farmer_id, u.full_name, f.location, f.district, f.state, f.verified
       FROM saved_farmers sf
       JOIN farmers f ON f.id = sf.farmer_id
       JOIN users u ON u.id = f.user_id
       WHERE sf.customer_id = :customerId`,
      { customerId }
    );
    return rows;
  }
};

module.exports = SavedFarmerModel;
