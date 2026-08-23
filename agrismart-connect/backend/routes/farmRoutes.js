// ============================================================
// Farm Routes -> /api/farms  (farmer-only, section 5)
// ============================================================
const express = require('express');
const router = express.Router();

const farmController = require('../controllers/farmController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('farmer'));

router.post('/', farmController.createFarm);
router.get('/', farmController.getMyFarms);
router.get('/:id', farmController.getFarmById);
router.put('/:id', farmController.updateFarm);
router.delete('/:id', farmController.deleteFarm);

module.exports = router;
