// ============================================================
// Growth Routes -> /api/growth  (section 9)
// ============================================================
const express = require('express');
const router = express.Router();

const growthController = require('../controllers/growthController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadGrowthImage } = require('../config/upload');

// Public: anyone (including guests) can view a crop's growth timeline for transparency
router.get('/:cropId', growthController.getGrowthTimeline);

// Farmer-only: add updates
router.post(
  '/:cropId',
  authenticate,
  authorize('farmer'),
  uploadGrowthImage.single('growthImage'),
  growthController.addGrowthUpdate
);

module.exports = router;
