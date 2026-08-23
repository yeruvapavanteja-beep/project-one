// ============================================================
// Recommendation Routes -> /api/recommendations (farmer-only)
// ============================================================
const express = require('express');
const router = express.Router();

const recommendationController = require('../controllers/recommendationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('farmer'));

router.post('/', recommendationController.getRecommendations);
router.get('/history', recommendationController.getRecommendationHistory);

module.exports = router;
