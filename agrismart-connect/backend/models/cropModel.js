// ============================================================
// Crop Model
// ============================================================
const pool = require('../config/db');

const CropModel = {
  async create(farmerId, farmId, data) {
    const {
      cropName, variety, categoryId, cropMasterId, areaCultivated, plantingDate,
      expectedHarvestDate, estimatedQuantityKg, expectedPricePerKg, description, coverImage
    } = data;
    const [result] = await pool.query(
      `INSERT INTO crops
        (farmer_id, farm_id, crop_master_id, crop_name, variety, category_id, area_cultivated,
         planting_date, expected_harvest_date, estimated_quantity_kg, expected_price_per_kg,
         description, cover_image, status, growth_percentage, growth_stage)
       VALUES
        (:farmerId, :farmId, :cropMasterId, :cropName, :variety, :categoryId, :areaCultivated,
         :plantingDate, :expectedHarvestDate, :estimatedQuantityKg, :expectedPricePerKg,
         :description, :coverImage, 'planned', 0, 'seedling')`,
      {
        farmerId, farmId, cropMasterId: cropMasterId || null, cropName, variety: variety || null,
        categoryId: categoryId || null, areaCultivated: areaCultivated || null,
        plantingDate: plantingDate || null, expectedHarvestDate: expectedHarvestDate || null,
        estimatedQuantityKg: estimatedQuantityKg || null, expectedPricePerKg: expectedPricePerKg || null,
        description: description || null, coverImage: coverImage || null
      }
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM crops WHERE id = :id LIMIT 1', { id });
    return rows[0] || null;
  },

  async findByIdAndFarmer(id, farmerId) {
    const [rows] = await pool.query('SELECT * FROM crops WHERE id = :id AND farmer_id = :farmerId LIMIT 1', { id, farmerId });
    return rows[0] || null;
  },

  async findAllByFarmer(farmerId, statusFilter = null) {
    let query = 'SELECT * FROM crops WHERE farmer_id = :farmerId';
    const params = { farmerId };
    if (statusFilter) { query += ' AND status = :statusFilter'; params.statusFilter = statusFilter; }
    query += ' ORDER BY created_at DESC';
    const [rows] = await pool.query(query, params);
    return rows;
  },

  async update(id, farmerId, fields) {
    const allowed = [
      'crop_name', 'variety', 'category_id', 'area_cultivated', 'planting_date', 'expected_harvest_date',
      'actual_harvest_date', 'estimated_quantity_kg', 'actual_quantity_kg', 'expected_price_per_kg',
      'available_for_prebooking_kg', 'description', 'cover_image', 'status', 'is_public'
    ];
    const setClauses = [];
    const params = { id, farmerId };
    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        setClauses.push(`${key} = :${key}`);
        params[key] = value;
      }
    }
    if (setClauses.length === 0) return;
    await pool.query(
      `UPDATE crops SET ${setClauses.join(', ')} WHERE id = :id AND farmer_id = :farmerId`,
      params
    );
  },

  async updateGrowth(id, farmerId, { growthPercentage, growthStage }) {
    await pool.query(
      `UPDATE crops SET growth_percentage = :growthPercentage, growth_stage = :growthStage WHERE id = :id AND farmer_id = :farmerId`,
      { id, farmerId, growthPercentage, growthStage }
    );
  },

  async delete(id, farmerId) {
    await pool.query('DELETE FROM crops WHERE id = :id AND farmer_id = :farmerId', { id, farmerId });
  },

  // -------- Public (customer-facing) queries --------
  // Section 9: customers see only non-sensitive fields for public/upcoming crops.
  async findPublicUpcoming({ district, category, cropName, limit = 20, offset = 0 } = {}) {
    let query = `
      SELECT c.id, c.crop_name, c.variety, c.expected_harvest_date, c.estimated_quantity_kg,
             c.available_for_prebooking_kg, c.prebooked_quantity_kg, c.growth_stage, c.growth_percentage,
             c.cover_image, c.status, f.location AS farm_location, f.district, f.state,
             u.full_name AS farmer_name, cm.name AS category_name
      FROM crops c
      JOIN farmers fr ON fr.id = c.farmer_id
      JOIN users u ON u.id = fr.user_id
      LEFT JOIN farms f ON f.id = c.farm_id
      LEFT JOIN categories cm ON cm.id = c.category_id
      WHERE c.is_public = TRUE AND c.status IN ('planned','growing','ready_for_harvest')
    `;
    const params = { limit, offset };
    if (district) { query += ' AND f.district = :district'; params.district = district; }
    if (category) { query += ' AND cm.slug = :category'; params.category = category; }
    if (cropName) { query += ' AND c.crop_name LIKE :cropName'; params.cropName = `%${cropName}%`; }
    query += ' ORDER BY c.expected_harvest_date ASC LIMIT :limit OFFSET :offset';

    const [rows] = await pool.query(query, params);
    return rows;
  },

  async findPublicById(id) {
    const [rows] = await pool.query(
      `SELECT c.id, c.crop_name, c.variety, c.description, c.expected_harvest_date, c.estimated_quantity_kg,
              c.available_for_prebooking_kg, c.prebooked_quantity_kg, c.growth_stage, c.growth_percentage,
              c.cover_image, c.status, c.expected_price_per_kg, f.location AS farm_location, f.district, f.state,
              u.full_name AS farmer_name, fr.id AS farmer_id
       FROM crops c
       JOIN farmers fr ON fr.id = c.farmer_id
       JOIN users u ON u.id = fr.user_id
       LEFT JOIN farms f ON f.id = c.farm_id
       WHERE c.id = :id AND c.is_public = TRUE LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }
};

module.exports = CropModel;
