// ============================================================
// Soil Test Model
// ============================================================
const pool = require('../config/db');

const SoilTestModel = {
  async create(farmId, data) {
    const {
      soilPh, nitrogen, phosphorus, potassium, organicMatter,
      soilType, waterAvailability, farmAreaTested, summaryCondition, notes
    } = data;
    const [result] = await pool.query(
      `INSERT INTO soil_tests
        (farm_id, soil_ph, nitrogen, phosphorus, potassium, organic_matter, soil_type, water_availability, farm_area_tested, summary_condition, notes)
       VALUES
        (:farmId, :soilPh, :nitrogen, :phosphorus, :potassium, :organicMatter, :soilType, :waterAvailability, :farmAreaTested, :summaryCondition, :notes)`,
      { farmId, soilPh, nitrogen, phosphorus, potassium, organicMatter, soilType, waterAvailability, farmAreaTested, summaryCondition, notes }
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM soil_tests WHERE id = :id LIMIT 1', { id });
    return rows[0] || null;
  },

  async findAllByFarm(farmId) {
    const [rows] = await pool.query('SELECT * FROM soil_tests WHERE farm_id = :farmId ORDER BY created_at DESC', { farmId });
    return rows;
  },

  async findLatestByFarm(farmId) {
    const [rows] = await pool.query(
      'SELECT * FROM soil_tests WHERE farm_id = :farmId ORDER BY created_at DESC LIMIT 1', { farmId }
    );
    return rows[0] || null;
  }
};

module.exports = SoilTestModel;
