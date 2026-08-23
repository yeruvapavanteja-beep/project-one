// ============================================================
// Order Routes -> /api/orders (section 13)
// ============================================================
const express = require('express');
const router = express.Router();

const orderController = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/', authorize('customer'), orderController.createOrder);
router.get('/my/customer', authorize('customer'), orderController.getMyOrdersAsCustomer);
router.get('/my/farmer', authorize('farmer'), orderController.getMyOrdersAsFarmer);
router.get('/:id', orderController.getOrderDetails);
router.patch('/:id/status', authorize('farmer'), orderController.updateOrderStatus);
router.delete('/:id', authorize('customer'), orderController.cancelOrderAsCustomer);

module.exports = router;
