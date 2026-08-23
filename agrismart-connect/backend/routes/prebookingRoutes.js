// ============================================================
// Pre-Booking Routes -> /api/prebookings (section 10)
// ============================================================
const express = require('express');
const router = express.Router();

const prebookingController = require('../controllers/prebookingController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Customer actions
router.post('/', authorize('customer'), prebookingController.createPrebooking);
router.delete('/:id', authorize('customer'), prebookingController.cancelPrebooking);
router.get('/my', authorize('customer'), prebookingController.getMyBookingsAsCustomer);

// Farmer actions
router.get('/farmer', authorize('farmer'), prebookingController.getMyBookingsAsFarmer);
router.patch('/:id/confirm', authorize('farmer'), prebookingController.farmerConfirmPrebooking);

// Shared: booking summary for a crop (farmer sees own; could be extended for admin)
router.get('/crop/:cropId/summary', authorize('farmer', 'admin'), prebookingController.getCropBookingSummary);

module.exports = router;
