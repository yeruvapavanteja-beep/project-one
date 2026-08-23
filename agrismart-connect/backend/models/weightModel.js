// ============================================================
// Recommendation Weights Model
// ============================================================
const pool = require('../config/db');

const WeightModel = {
  async getActiveWeights() {
    const [rows] = await pool.query(
      'SELECT weight_key, weight_value FROM recommendation_weights WHERE is_active = TRUE'
    );
    const weights = {};
    rows.forEach((r) => { weights[r.weight_key] = parseFloat(r.weight_value); });
    return weights;
  },

  async updateWeight(key, value) {
    await pool.query(
      'UPDATE recommendation_weights SET weight_value = :value WHERE weight_key = :key',
      { key, value }
    );
  },

  async getAll() {
    const [rows] = await pool.query('SELECT * FROM recommendation_weights ORDER BY weight_key');
    return rows;
  }
};

module.exports = WeightModel;
