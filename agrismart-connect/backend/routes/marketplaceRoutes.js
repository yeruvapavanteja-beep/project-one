// ============================================================
// Marketplace Routes -> /api/marketplace (section 11, public)
// ============================================================
const express = require('express');
const router = express.Router();

const marketplaceController = require('../controllers/marketplaceController');

router.get('/products', marketplaceController.browseProducts);
router.get('/products/:id', marketplaceController.getProductDetails);
router.get('/categories', marketplaceController.getCategories);

module.exports = router;
