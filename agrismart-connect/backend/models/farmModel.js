// ============================================================
// Farm Model
// ============================================================
const pool = require('../config/db');

const FarmModel = {
  async create(farmerId, data) {
    const {
      farmName, location, district, state, farmArea,
      soilType, irrigationType, waterAvailability, farmingExperienceYears
    } = data;
    const [result] = await pool.query(
      `INSERT INTO farms
        (farmer_id, farm_name, location, district, state, farm_area, soil_type, irrigation_type, water_availability, farming_experience_years)
       VALUES
        (:farmerId, :farmName, :location, :district, :state, :farmArea, :soilType, :irrigationType, :waterAvailability, :farmingExperienceYears)`,
      { farmerId, farmName, location, district, state, farmArea, soilType, irrigationType, waterAvailability, farmingExperienceYears }
    );
    return result.insertId;
  },

  async findAllByFarmer(farmerId) {
    const [rows] = await pool.query('SELECT * FROM farms WHERE farmer_id = :farmerId ORDER BY created_at DESC', { farmerId });
    return rows;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM farms WHERE id = :id LIMIT 1', { id });
    return rows[0] || null;
  },

  async findByIdAndFarmer(id, farmerId) {
    const [rows] = await pool.query('SELECT * FROM farms WHERE id = :id AND farmer_id = :farmerId LIMIT 1', { id, farmerId });
    return rows[0] || null;
  },

  async update(id, farmerId, data) {
    const {
      farmName, location, district, state, farmArea,
      soilType, irrigationType, waterAvailability, farmingExperienceYears
    } = data;
    await pool.query(
      `UPDATE farms SET
        farm_name = :farmName, location = :location, district = :district, state = :state,
        farm_area = :farmArea, soil_type = :soilType, irrigation_type = :irrigationType,
        water_availability = :waterAvailability, farming_experience_years = :farmingExperienceYears
       WHERE id = :id AND farmer_id = :farmerId`,
      { id, farmerId, farmName, location, district, state, farmArea, soilType, irrigationType, waterAvailability, farmingExperienceYears }
    );
  },

  async delete(id, farmerId) {
    await pool.query('DELETE FROM farms WHERE id = :id AND farmer_id = :farmerId', { id, farmerId });
  }
};

module.exports = FarmModel;
