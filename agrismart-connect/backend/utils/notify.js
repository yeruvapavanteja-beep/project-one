// ============================================================
// Notification helper
// Used by controllers across modules (pre-bookings, orders, etc.)
// to insert entries into the notifications table (section 24).
// ============================================================
const pool = require('../config/db');

/**
 * Create a notification for a user.
 * @param {number} userId - the users.id (not farmer_id/customer_id) to notify
 * @param {string} type - short machine-readable type, e.g. 'new_prebooking'
 * @param {string} title
 * @param {string} message
 * @param {string} [referenceType] - e.g. 'order', 'prebooking', 'crop'
 * @param {number} [referenceId]
 */
async function createNotification(userId, type, title, message, referenceType = null, referenceId = null) {
  await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
     VALUES (:userId, :type, :title, :message, :referenceType, :referenceId)`,
    { userId, type, title, message, referenceType, referenceId }
  );
}

module.exports = { createNotification };
