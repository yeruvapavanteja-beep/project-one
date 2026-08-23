// ============================================================
// Crop Growth Update Model
// ============================================================
const pool = require('../config/db');

const GrowthModel = {
  async create(cropId, { image, growthPercentage, growthStage, healthStatus, notes, updateDate }) {
    const [result] = await pool.query(
      `INSERT INTO crop_growth_updates (crop_id, image, growth_percentage, growth_stage, health_status, notes, update_date)
       VALUES (:cropId, :image, :growthPercentage, :growthStage, :healthStatus, :notes, :updateDate)`,
      { cropId, image: image || null, growthPercentage, growthStage, healthStatus: healthStatus || 'good', notes: notes || null, updateDate: updateDate || new Date().toISOString().slice(0, 10) }
    );
    return result.insertId;
  },

  async findAllByCrop(cropId) {
    const [rows] = await pool.query(
      'SELECT * FROM crop_growth_updates WHERE crop_id = :cropId ORDER BY update_date ASC, created_at ASC',
      { cropId }
    );
    return rows;
  }
};

module.exports = GrowthModel;
