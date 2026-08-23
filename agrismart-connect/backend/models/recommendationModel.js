// ============================================================
// Crop Recommendation Log Model
// ============================================================
const pool = require('../config/db');

const RecommendationModel = {
  async logRun(farmerId, { farmId, soilTestId, season, inputSnapshot, results }) {
    const [result] = await pool.query(
      `INSERT INTO crop_recommendations (farmer_id, farm_id, soil_test_id, season, input_snapshot, results, engine_version)
       VALUES (:farmerId, :farmId, :soilTestId, :season, :inputSnapshot, :results, 'rule-based-v1')`,
      {
        farmerId,
        farmId: farmId || null,
        soilTestId: soilTestId || null,
        season: season || null,
        inputSnapshot: JSON.stringify(inputSnapshot),
        results: JSON.stringify(results)
      }
    );
    return result.insertId;
  },

  async findHistoryByFarmer(farmerId, limit = 10) {
    const [rows] = await pool.query(
      `SELECT id, season, results, engine_version, created_at
       FROM crop_recommendations WHERE farmer_id = :farmerId
       ORDER BY created_at DESC LIMIT :limit`,
      { farmerId, limit }
    );
    return rows.map((r) => ({ ...r, results: typeof r.results === 'string' ? JSON.parse(r.results) : r.results }));
  }
};

module.exports = RecommendationModel;
