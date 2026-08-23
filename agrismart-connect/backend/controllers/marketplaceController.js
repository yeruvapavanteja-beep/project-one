// ============================================================
// Marketplace Controller -> section 11
// Public browsing with filters; no auth required to view.
// ============================================================
const ProductModel = require('../models/productModel');
const pool = require('../config/db');
const { success, asyncHandler } = require('../utils/response');

const browseProducts = asyncHandler(async (req, res) => {
  const { district, category, cropName, minPrice, maxPrice, upcomingOnly, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  const products = await ProductModel.search({
    district, category, cropName,
    minPrice: minPrice ? Number(minPrice) : null,
    maxPrice: maxPrice ? Number(maxPrice) : null,
    upcomingOnly: upcomingOnly === 'true',
    limit: Number(limit), offset: Number(offset)
  });

  return success(res, products);
});

const getProductDetails = asyncHandler(async (req, res) => {
  const product = await ProductModel.findById(req.params.id);
  if (!product) return success(res, null, 'Product not found.', 404);

  const [cropRows] = await pool.query(
    `SELECT c.*, f.location AS farm_location, f.district, f.state, u.full_name AS farmer_name, fr.verified
     FROM crops c
     JOIN farmers fr ON fr.id = c.farmer_id
     JOIN users u ON u.id = fr.user_id
     LEFT JOIN farms f ON f.id = c.farm_id
     WHERE c.id = :cropId`,
    { cropId: product.crop_id }
  );

  return success(res, { product, crop: cropRows[0] || null });
});

const getCategories = asyncHandler(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
  return success(res, rows);
});

module.exports = { browseProducts, getProductDetails, getCategories };
