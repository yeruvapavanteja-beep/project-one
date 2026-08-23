// ============================================================
// Product Model
// A "product" is the marketplace-facing listing for a crop.
// Kept in sync automatically whenever the underlying crop changes
// (price, quantity, status) so customers always see accurate data.
// ============================================================
const pool = require('../config/db');

const ProductModel = {
  async findByCropId(cropId) {
    const [rows] = await pool.query('SELECT * FROM products WHERE crop_id = :cropId LIMIT 1', { cropId });
    return rows[0] || null;
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = :id LIMIT 1', { id });
    return rows[0] || null;
  },

  /**
   * Creates or updates the products row for a given crop so it always
   * reflects the crop's current price/quantity/status. Call this after
   * any crop create/update/status-change.
   */
  async syncFromCrop(cropId) {
    const [cropRows] = await pool.query('SELECT * FROM crops WHERE id = :cropId LIMIT 1', { cropId });
    const crop = cropRows[0];
    if (!crop) return null;

    const isUpcoming = ['planned', 'growing', 'ready_for_harvest'].includes(crop.status);
    const totalQty = crop.estimated_quantity_kg || 0;
    const availableQty = isUpcoming
      ? Math.max(0, (crop.available_for_prebooking_kg || 0) - (crop.prebooked_quantity_kg || 0))
      : Math.max(0, (crop.actual_quantity_kg || crop.estimated_quantity_kg || 0) - (crop.sold_quantity_kg || 0));
    const isActive = crop.is_public && crop.status !== 'completed';

    const existing = await ProductModel.findByCropId(cropId);
    if (existing) {
      await pool.query(
        `UPDATE products SET title = :title, price_per_kg = :price, total_quantity_kg = :totalQty,
           available_quantity_kg = :availableQty, is_upcoming = :isUpcoming, is_active = :isActive,
           category_id = :categoryId
         WHERE crop_id = :cropId`,
        {
          cropId, title: `${crop.crop_name}${crop.variety ? ' - ' + crop.variety : ''}`,
          price: crop.expected_price_per_kg || 0, totalQty, availableQty, isUpcoming, isActive,
          categoryId: crop.category_id || null
        }
      );
      return ProductModel.findByCropId(cropId);
    } else {
      await pool.query(
        `INSERT INTO products (crop_id, farmer_id, category_id, title, price_per_kg, total_quantity_kg, available_quantity_kg, is_upcoming, is_active)
         VALUES (:cropId, :farmerId, :categoryId, :title, :price, :totalQty, :availableQty, :isUpcoming, :isActive)`,
        {
          cropId, farmerId: crop.farmer_id, categoryId: crop.category_id || null,
          title: `${crop.crop_name}${crop.variety ? ' - ' + crop.variety : ''}`,
          price: crop.expected_price_per_kg || 0, totalQty, availableQty, isUpcoming, isActive
        }
      );
      return ProductModel.findByCropId(cropId);
    }
  },

  async search({ district, category, cropName, minPrice, maxPrice, upcomingOnly, limit = 20, offset = 0 } = {}) {
    let query = `
      SELECT p.*, c.crop_name, c.expected_harvest_date, c.growth_stage, c.growth_percentage, c.cover_image,
             f.location AS farm_location, f.district, f.state, u.full_name AS farmer_name, cat.name AS category_name
      FROM products p
      JOIN crops c ON c.id = p.crop_id
      JOIN farmers fr ON fr.id = p.farmer_id
      JOIN users u ON u.id = fr.user_id
      LEFT JOIN farms f ON f.id = c.farm_id
      LEFT JOIN categories cat ON cat.id = p.category_id
      WHERE p.is_active = TRUE AND p.available_quantity_kg > 0
    `;
    const params = { limit, offset };
    if (district) { query += ' AND f.district = :district'; params.district = district; }
    if (category) { query += ' AND cat.slug = :category'; params.category = category; }
    if (cropName) { query += ' AND c.crop_name LIKE :cropName'; params.cropName = `%${cropName}%`; }
    if (minPrice) { query += ' AND p.price_per_kg >= :minPrice'; params.minPrice = minPrice; }
    if (maxPrice) { query += ' AND p.price_per_kg <= :maxPrice'; params.maxPrice = maxPrice; }
    if (upcomingOnly) { query += ' AND p.is_upcoming = TRUE'; }
    query += ' ORDER BY p.updated_at DESC LIMIT :limit OFFSET :offset';

    const [rows] = await pool.query(query, params);
    return rows;
  }
};

module.exports = ProductModel;
