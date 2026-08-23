// ============================================================
// Analytics Routes -> /api/analytics (sections 15 & 16)
// ============================================================
const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/demand', authenticate, analyticsController.getDemandAnalytics);
router.get('/farmer', authenticate, authorize('farmer'), analyticsController.getFarmerAnalytics);

module.exports = router;
