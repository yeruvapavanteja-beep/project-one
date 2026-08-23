// ============================================================
// Admin Routes -> /api/admin (section 17, admin-only)
// ============================================================
const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('admin'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/farmers', adminController.listFarmers);
router.get('/customers', adminController.listCustomers);
router.patch('/users/:userId/status', adminController.updateUserStatus);
router.patch('/farmers/:farmerId/verify', adminController.verifyFarmer);
router.get('/crops', adminController.listAllCrops);
router.get('/orders', adminController.listAllOrders);
router.get('/prebookings', adminController.listAllPrebookings);
router.get('/complaints', adminController.listComplaints);
router.patch('/complaints/:id', adminController.updateComplaintStatus);
router.post('/categories', adminController.createCategory);
router.post('/locations', adminController.createLocation);

module.exports = router;
