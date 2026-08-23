// ============================================================
// Soil Routes -> /api/soil  (farmer-only, section 6)
// ============================================================
const express = require('express');
const router = express.Router();

const soilController = require('../controllers/soilController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('farmer'));

router.post('/', soilController.submitSoilTest);
router.get('/farm/:farmId', soilController.getFarmSoilTests);

module.exports = router;
