// ============================================================
// Order Controller -> section 13-14
// ============================================================
const OrderModel = require('../models/orderModel');
const UserModel = require('../models/userModel');
const { createNotification } = require('../utils/notify');
const { success, error, asyncHandler } = require('../utils/response');
const pool = require('../config/db');

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled'];

const createOrder = asyncHandler(async (req, res) => {
  const customer = await UserModel.findCustomerByUserId(req.user.id);
  if (!customer) return error(res, 'Customer profile not found.', 404);

  const { items, fulfillmentType, deliveryAddress } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return error(res, 'At least one item is required to place an order.', 422);
  }

  try {
    const result = await OrderModel.createOrder({
      customerId: customer.id, items, fulfillmentType, deliveryAddress: deliveryAddress || customer.address
    });

    const [farmerRow] = await pool.query('SELECT user_id FROM farmers WHERE id = :id', { id: result.farmerId });
    if (farmerRow[0]) {
      await createNotification(
        farmerRow[0].user_id, 'new_order', 'New Order Received',
        `You received a new order (${result.orderNumber}) worth ₹${result.totalAmount}.`,
        'order', result.orderId
      );
    }

    const order = await OrderModel.findById(result.orderId);
    const orderItems = await OrderModel.findItemsByOrder(result.orderId);
    return success(res, { order, items: orderItems }, 'Order placed successfully.', 201);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    throw err;
  }
});

const getMyOrdersAsCustomer = asyncHandler(async (req, res) => {
  const customer = await UserModel.findCustomerByUserId(req.user.id);
  if (!customer) return error(res, 'Customer profile not found.', 404);
  const orders = await OrderModel.findByCustomer(customer.id);
  return success(res, orders);
});

const getMyOrdersAsFarmer = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);
  const orders = await OrderModel.findByFarmer(farmer.id);
  return success(res, orders);
});

const getOrderDetails = asyncHandler(async (req, res) => {
  const order = await OrderModel.findById(req.params.id);
  if (!order) return error(res, 'Order not found.', 404);

  // Ensure requester owns this order (as customer or farmer)
  const customer = await UserModel.findCustomerByUserId(req.user.id);
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  const isOwner = (customer && order.customer_id === customer.id) || (farmer && order.farmer_id === farmer.id) || req.user.role === 'admin';
  if (!isOwner) return error(res, 'You do not have permission to view this order.', 403);

  const items = await OrderModel.findItemsByOrder(order.id);
  return success(res, { order, items });
});

// Farmer updates order status through the fulfillment pipeline (section 14).
const updateOrderStatus = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);

  const { status, cancelledReason } = req.body;
  if (!VALID_STATUSES.includes(status)) return error(res, `Status must be one of: ${VALID_STATUSES.join(', ')}`, 422);

  const order = await OrderModel.findById(req.params.id);
  if (!order || order.farmer_id !== farmer.id) return error(res, 'Order not found.', 404);

  await OrderModel.updateStatus(req.params.id, farmer.id, status, cancelledReason || null);

  const [customerRow] = await pool.query('SELECT user_id FROM customers WHERE id = :id', { id: order.customer_id });
  if (customerRow[0]) {
    await createNotification(
      customerRow[0].user_id, 'order_status_update', 'Order Status Updated',
      `Your order ${order.order_number} is now "${status.replace(/_/g, ' ')}".`,
      'order', order.id
    );
  }

  const updated = await OrderModel.findById(req.params.id);
  return success(res, updated, 'Order status updated.');
});

const cancelOrderAsCustomer = asyncHandler(async (req, res) => {
  const customer = await UserModel.findCustomerByUserId(req.user.id);
  if (!customer) return error(res, 'Customer profile not found.', 404);

  try {
    const order = await OrderModel.cancelByCustomer(req.params.id, customer.id);
    const [farmerRow] = await pool.query('SELECT user_id FROM farmers WHERE id = :id', { id: order.farmer_id });
    if (farmerRow[0]) {
      await createNotification(
        farmerRow[0].user_id, 'order_cancelled', 'Order Cancelled',
        `Order ${order.order_number} was cancelled by the customer.`, 'order', order.id
      );
    }
    return success(res, null, 'Order cancelled successfully.');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    throw err;
  }
});

module.exports = {
  createOrder, getMyOrdersAsCustomer, getMyOrdersAsFarmer,
  getOrderDetails, updateOrderStatus, cancelOrderAsCustomer
};
