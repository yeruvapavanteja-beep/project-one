// ============================================================
// Notification Controller -> section 24
// ============================================================
const pool = require('../config/db');
const { success, error, asyncHandler } = require('../utils/response');

const getMyNotifications = asyncHandler(async (req, res) => {
  const { unreadOnly } = req.query;
  let query = 'SELECT * FROM notifications WHERE user_id = :userId';
  const params = { userId: req.user.id };
  if (unreadOnly === 'true') query += ' AND is_read = FALSE';
  query += ' ORDER BY created_at DESC LIMIT 50';

  const [rows] = await pool.query(query, params);
  return success(res, rows);
});

const markAsRead = asyncHandler(async (req, res) => {
  await pool.query(
    'UPDATE notifications SET is_read = TRUE WHERE id = :id AND user_id = :userId',
    { id: req.params.id, userId: req.user.id }
  );
  return success(res, null, 'Notification marked as read.');
});

const markAllAsRead = asyncHandler(async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = :userId', { userId: req.user.id });
  return success(res, null, 'All notifications marked as read.');
});

const getUnreadCount = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS count FROM notifications WHERE user_id = :userId AND is_read = FALSE',
    { userId: req.user.id }
  );
  return success(res, { count: rows[0].count });
});

module.exports = { getMyNotifications, markAsRead, markAllAsRead, getUnreadCount };
