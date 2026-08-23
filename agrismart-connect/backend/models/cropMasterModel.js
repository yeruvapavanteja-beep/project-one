// ============================================================
// Crop Master Model
// Reference data used by the recommendation engine.
// ============================================================
const pool = require('../config/db');

const CropMasterModel = {
  async findAll() {
    const [rows] = await pool.query('SELECT * FROM crop_master ORDER BY crop_name');
    return rows;
  },

  async findByName(cropName) {
    const [rows] = await pool.query('SELECT * FROM crop_master WHERE crop_name = :cropName LIMIT 1', { cropName });
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM crop_master WHERE id = :id LIMIT 1', { id });
    return rows[0] || null;
  },

  // Average demand_score for a crop from market_demand, optionally scoped
  // to district/season. Falls back to crop_master.base_demand_score (sample data)
  // when no real records exist, and flags whether the result is sample data.
  async getDemandScore(cropMasterId, { district = null, season = null } = {}) {
    let query = 'SELECT AVG(demand_score) AS avgScore, MIN(is_sample_data) AS allSample, COUNT(*) AS recordCount FROM market_demand WHERE crop_master_id = :cropMasterId';
    const params = { cropMasterId };
    if (district) { query += ' AND (district = :district OR district IS NULL)'; params.district = district; }
    if (season) { query += ' AND (season = :season OR season IS NULL)'; params.season = season; }

    const [rows] = await pool.query(query, params);
    const row = rows[0];

    if (row && row.recordCount > 0 && row.avgScore != null) {
      return { score: parseFloat(row.avgScore), isSampleData: !!row.allSample };
    }

    const crop = await CropMasterModel.findById(cropMasterId);
    return { score: crop ? parseFloat(crop.base_demand_score) : 5.0, isSampleData: true };
  }
};

module.exports = CropMasterModel;
