// ============================================================
// Crop Routes -> /api/crops
// Mix of farmer-only (auth) and public (customer-facing) routes.
// ============================================================
const express = require('express');
const router = express.Router();

const cropController = require('../controllers/cropController');
const { authenticate, authorize } = require('../middleware/auth');
const { uploadCropImage } = require('../config/upload');

// ---------------- Public routes (no auth required) ----------------
// Section 9: customers can see public upcoming-crop info without exposing farmer sensitive data.
router.get('/public/upcoming', cropController.getPublicUpcomingCrops);
router.get('/public/:id', cropController.getPublicCropById);

// ---------------- Farmer-only routes ----------------
router.use(authenticate, authorize('farmer'));

router.post('/', uploadCropImage.single('cropImage'), cropController.createCrop);
router.get('/', cropController.getMyCrops);
router.get('/:id', cropController.getCropById);
router.put('/:id', uploadCropImage.single('cropImage'), cropController.updateCrop);
router.patch('/:id/status', cropController.updateCropStatus);
router.delete('/:id', cropController.deleteCrop);

module.exports = router;
