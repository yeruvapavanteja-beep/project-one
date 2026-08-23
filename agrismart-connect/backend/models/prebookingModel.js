// ============================================================
// Pre-Booking Model -> section 10 (core innovation)
// Uses a DB transaction with row locking to prevent overbooking
// when multiple customers book the same crop concurrently.
// ============================================================
const pool = require('../config/db');

const PrebookingModel = {
  /**
   * Atomically creates a pre-booking if enough quantity remains.
   * Throws an Error with .statusCode set on business-rule failures
   * so the controller can surface a clean message.
   */
  async createBooking({ customerId, cropId, quantityKg }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Lock the crop row so concurrent bookings can't both pass the check.
      const [cropRows] = await conn.query(
        'SELECT * FROM crops WHERE id = :cropId FOR UPDATE', { cropId }
      );
      const crop = cropRows[0];
      if (!crop) {
        const e = new Error('Crop not found.'); e.statusCode = 404; throw e;
      }
      if (!['planned', 'growing', 'ready_for_harvest'].includes(crop.status)) {
        const e = new Error('This crop is no longer open for pre-booking.'); e.statusCode = 409; throw e;
      }

      const remaining = parseFloat(crop.available_for_prebooking_kg) - parseFloat(crop.prebooked_quantity_kg);
      if (quantityKg > remaining) {
        const e = new Error(`Only ${remaining}kg remains available for pre-booking.`); e.statusCode = 409; throw e;
      }

      const [farmerRows] = await conn.query('SELECT user_id FROM farmers WHERE id = :farmerId', { farmerId: crop.farmer_id });
      const [customerRows] = await conn.query('SELECT user_id FROM customers WHERE id = :customerId', { customerId });

      // Rule (section 23 #1): a farmer cannot pre-book their own crop as a customer.
      if (farmerRows[0] && customerRows[0] && farmerRows[0].user_id === customerRows[0].user_id) {
        const e = new Error('You cannot pre-book your own crop.'); e.statusCode = 403; throw e;
      }

      const [insertResult] = await conn.query(
        `INSERT INTO pre_bookings (customer_id, crop_id, farmer_id, quantity_kg, price_per_kg_at_booking, status, expected_harvest_date)
         VALUES (:customerId, :cropId, :farmerId, :quantityKg, :price, 'pending', :harvestDate)`,
        {
          customerId, cropId, farmerId: crop.farmer_id, quantityKg,
          price: crop.expected_price_per_kg || 0, harvestDate: crop.expected_harvest_date
        }
      );

      await conn.query(
        'UPDATE crops SET prebooked_quantity_kg = prebooked_quantity_kg + :qty WHERE id = :cropId',
        { qty: quantityKg, cropId }
      );

      await conn.commit();
      return { id: insertResult.insertId, farmerUserId: farmerRows[0]?.user_id };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  /**
   * Cancels a booking and releases the reserved quantity back to the pool
   * (section 23 #5).
   */
  async cancelBooking(bookingId, { byUserId, isFarmerCancelling = false }) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [rows] = await conn.query('SELECT * FROM pre_bookings WHERE id = :bookingId FOR UPDATE', { bookingId });
      const booking = rows[0];
      if (!booking) { const e = new Error('Booking not found.'); e.statusCode = 404; throw e; }
      if (booking.status === 'cancelled') { const e = new Error('Booking is already cancelled.'); e.statusCode = 409; throw e; }

      await conn.query('UPDATE pre_bookings SET status = "cancelled" WHERE id = :bookingId', { bookingId });
      await conn.query(
        'UPDATE crops SET prebooked_quantity_kg = GREATEST(0, prebooked_quantity_kg - :qty) WHERE id = :cropId',
        { qty: booking.quantity_kg, cropId: booking.crop_id }
      );

      await conn.commit();
      return booking;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM pre_bookings WHERE id = :id LIMIT 1', { id });
    return rows[0] || null;
  },

  async findByCustomer(customerId) {
    const [rows] = await pool.query(
      `SELECT pb.*, c.crop_name, c.cover_image, c.expected_harvest_date AS crop_harvest_date, u.full_name AS farmer_name
       FROM pre_bookings pb
       JOIN crops c ON c.id = pb.crop_id
       JOIN farmers fr ON fr.id = pb.farmer_id
       JOIN users u ON u.id = fr.user_id
       WHERE pb.customer_id = :customerId ORDER BY pb.created_at DESC`,
      { customerId }
    );
    return rows;
  },

  async findByFarmer(farmerId) {
    const [rows] = await pool.query(
      `SELECT pb.*, c.crop_name, u.full_name AS customer_name
       FROM pre_bookings pb
       JOIN crops c ON c.id = pb.crop_id
       JOIN customers cu ON cu.id = pb.customer_id
       JOIN users u ON u.id = cu.user_id
       WHERE pb.farmer_id = :farmerId ORDER BY pb.created_at DESC`,
      { farmerId }
    );
    return rows;
  },

  async findByCropSummary(cropId) {
    const [rows] = await pool.query(
      `SELECT COUNT(DISTINCT customer_id) AS customerCount, COALESCE(SUM(quantity_kg),0) AS totalBooked
       FROM pre_bookings WHERE crop_id = :cropId AND status IN ('pending','confirmed')`,
      { cropId }
    );
    return rows[0];
  },

  async updateStatus(bookingId, farmerId, status) {
    await pool.query(
      'UPDATE pre_bookings SET status = :status WHERE id = :bookingId AND farmer_id = :farmerId',
      { bookingId, farmerId, status }
    );
  }
};

module.exports = PrebookingModel;
