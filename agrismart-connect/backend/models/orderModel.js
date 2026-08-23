// ============================================================
// Order Model -> section 13
// Orders are created transactionally: quantity is deducted from
// the product/crop atomically to prevent selling more than available,
// mirroring the same safety pattern used for pre-bookings.
// ============================================================
const pool = require('../config/db');

function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ASC-${ts}-${rand}`;
}

const OrderModel = {
  /**
   * items: [{ productId, quantityKg }]
   */
  async createOrder({ customerId, items, fulfillmentType, deliveryAddress, prebookingId = null }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (!items || items.length === 0) {
        const e = new Error('Cart is empty.'); e.statusCode = 422; throw e;
      }

      // All items in one order must belong to the same farmer in this simple v1 model.
      let farmerId = null;
      let subtotal = 0;
      const resolvedItems = [];

      for (const item of items) {
        const [productRows] = await conn.query('SELECT * FROM products WHERE id = :id FOR UPDATE', { id: item.productId });
        const product = productRows[0];
        if (!product) { const e = new Error(`Product ${item.productId} not found.`); e.statusCode = 404; throw e; }
        if (!product.is_active) { const e = new Error(`${product.title} is no longer available.`); e.statusCode = 409; throw e; }
        if (parseFloat(item.quantityKg) > parseFloat(product.available_quantity_kg)) {
          const e = new Error(`Only ${product.available_quantity_kg}kg of ${product.title} is available.`); e.statusCode = 409; throw e;
        }
        if (farmerId === null) farmerId = product.farmer_id;
        if (farmerId !== product.farmer_id) {
          const e = new Error('All items in a single order must be from the same farmer. Please place separate orders.');
          e.statusCode = 422; throw e;
        }

        const lineTotal = parseFloat(item.quantityKg) * parseFloat(product.price_per_kg);
        subtotal += lineTotal;
        resolvedItems.push({ product, quantityKg: parseFloat(item.quantityKg), lineTotal });
      }

      const deliveryFee = fulfillmentType === 'delivery' ? 30 : 0; // simple flat demo fee, payment-ready field only
      const totalAmount = subtotal + deliveryFee;
      const orderNumber = generateOrderNumber();

      const [orderResult] = await conn.query(
        `INSERT INTO orders (order_number, customer_id, farmer_id, pre_booking_id, subtotal, delivery_fee, total_amount, fulfillment_type, delivery_address, status, payment_status)
         VALUES (:orderNumber, :customerId, :farmerId, :prebookingId, :subtotal, :deliveryFee, :totalAmount, :fulfillmentType, :deliveryAddress, 'pending', 'unpaid')`,
        { orderNumber, customerId, farmerId, prebookingId, subtotal, deliveryFee, totalAmount, fulfillmentType: fulfillmentType || 'delivery', deliveryAddress: deliveryAddress || null }
      );
      const orderId = orderResult.insertId;

      for (const ri of resolvedItems) {
        await conn.query(
          `INSERT INTO order_items (order_id, product_id, crop_id, quantity_kg, price_per_kg, line_total)
           VALUES (:orderId, :productId, :cropId, :quantityKg, :pricePerKg, :lineTotal)`,
          { orderId, productId: ri.product.id, cropId: ri.product.crop_id, quantityKg: ri.quantityKg, pricePerKg: ri.product.price_per_kg, lineTotal: ri.lineTotal }
        );
        await conn.query(
          'UPDATE products SET available_quantity_kg = available_quantity_kg - :qty WHERE id = :id',
          { qty: ri.quantityKg, id: ri.product.id }
        );
        await conn.query(
          'UPDATE crops SET sold_quantity_kg = sold_quantity_kg + :qty WHERE id = :cropId',
          { qty: ri.quantityKg, cropId: ri.product.crop_id }
        );
      }

      await conn.commit();
      return { orderId, orderNumber, farmerId, totalAmount };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM orders WHERE id = :id LIMIT 1', { id });
    return rows[0] || null;
  },

  async findItemsByOrder(orderId) {
    const [rows] = await pool.query(
      `SELECT oi.*, c.crop_name, c.cover_image FROM order_items oi
       JOIN crops c ON c.id = oi.crop_id WHERE oi.order_id = :orderId`,
      { orderId }
    );
    return rows;
  },

  async findByCustomer(customerId) {
    const [rows] = await pool.query(
      `SELECT o.*, u.full_name AS farmer_name FROM orders o
       JOIN farmers f ON f.id = o.farmer_id
       JOIN users u ON u.id = f.user_id
       WHERE o.customer_id = :customerId ORDER BY o.created_at DESC`,
      { customerId }
    );
    return rows;
  },

  async findByFarmer(farmerId) {
    const [rows] = await pool.query(
      `SELECT o.*, u.full_name AS customer_name FROM orders o
       JOIN customers c ON c.id = o.customer_id
       JOIN users u ON u.id = c.user_id
       WHERE o.farmer_id = :farmerId ORDER BY o.created_at DESC`,
      { farmerId }
    );
    return rows;
  },

  async updateStatus(orderId, farmerId, status, cancelledReason = null) {
    await pool.query(
      'UPDATE orders SET status = :status, cancelled_reason = :cancelledReason WHERE id = :orderId AND farmer_id = :farmerId',
      { orderId, farmerId, status, cancelledReason }
    );
  },

  // If a customer cancels a pending order, release the reserved quantity.
  async cancelByCustomer(orderId, customerId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query('SELECT * FROM orders WHERE id = :orderId AND customer_id = :customerId FOR UPDATE', { orderId, customerId });
      const order = rows[0];
      if (!order) { const e = new Error('Order not found.'); e.statusCode = 404; throw e; }
      if (!['pending', 'confirmed'].includes(order.status)) {
        const e = new Error('Only pending or confirmed orders can be cancelled by the customer.'); e.statusCode = 409; throw e;
      }

      const [items] = await conn.query('SELECT * FROM order_items WHERE order_id = :orderId', { orderId });
      for (const item of items) {
        await conn.query('UPDATE products SET available_quantity_kg = available_quantity_kg + :qty WHERE id = :id', { qty: item.quantity_kg, id: item.product_id });
        await conn.query('UPDATE crops SET sold_quantity_kg = GREATEST(0, sold_quantity_kg - :qty) WHERE id = :cropId', { qty: item.quantity_kg, cropId: item.crop_id });
      }
      await conn.query('UPDATE orders SET status = "cancelled", cancelled_reason = "Cancelled by customer" WHERE id = :orderId', { orderId });

      await conn.commit();
      return order;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
};

module.exports = OrderModel;
