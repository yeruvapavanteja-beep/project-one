// ============================================================
// Admin Controller -> section 17
// ============================================================
const pool = require('../config/db');
const { success, error, asyncHandler } = require('../utils/response');

const getDashboardStats = asyncHandler(async (req, res) => {
  const [[farmers]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'farmer'");
  const [[customers]] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'");
  const [[activeCrops]] = await pool.query("SELECT COUNT(*) AS count FROM crops WHERE status IN ('planned','growing','ready_for_harvest')");
  const [[upcomingHarvests]] = await pool.query("SELECT COUNT(*) AS count FROM crops WHERE status IN ('growing','ready_for_harvest') AND expected_harvest_date >= CURDATE()");
  const [[totalOrders]] = await pool.query('SELECT COUNT(*) AS count FROM orders');
  const [[totalPrebookings]] = await pool.query('SELECT COUNT(*) AS count FROM pre_bookings');

  return success(res, {
    totalFarmers: farmers.count,
    totalCustomers: customers.count,
    activeCrops: activeCrops.count,
    upcomingHarvests: upcomingHarvests.count,
    totalOrders: totalOrders.count,
    totalPrebookings: totalPrebookings.count
  });
});

const listFarmers = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, f.id AS farmer_id, f.district, f.state, f.verified
     FROM users u JOIN farmers f ON f.user_id = u.id
     WHERE u.role = 'farmer' ORDER BY u.created_at DESC`
  );
  return success(res, rows);
});

const listCustomers = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.full_name, u.email, u.phone, u.status, u.created_at, c.id AS customer_id, c.location
     FROM users u JOIN customers c ON c.user_id = u.id
     WHERE u.role = 'customer' ORDER BY u.created_at DESC`
  );
  return success(res, rows);
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'pending'].includes(status)) return error(res, 'Invalid status.', 422);
  await pool.query('UPDATE users SET status = :status WHERE id = :id', { status, id: req.params.userId });
  return success(res, null, 'User status updated.');
});

const verifyFarmer = asyncHandler(async (req, res) => {
  await pool.query('UPDATE farmers SET verified = TRUE WHERE id = :id', { id: req.params.farmerId });
  return success(res, null, 'Farmer marked as verified.');
});

const listAllCrops = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT c.id, c.crop_name, c.status, c.expected_harvest_date, c.estimated_quantity_kg, u.full_name AS farmer_name
     FROM crops c JOIN farmers f ON f.id = c.farmer_id JOIN users u ON u.id = f.user_id
     ORDER BY c.created_at DESC LIMIT 200`
  );
  return success(res, rows);
});

const listAllOrders = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT o.*, uc.full_name AS customer_name, uf.full_name AS farmer_name
     FROM orders o
     JOIN customers c ON c.id = o.customer_id JOIN users uc ON uc.id = c.user_id
     JOIN farmers f ON f.id = o.farmer_id JOIN users uf ON uf.id = f.user_id
     ORDER BY o.created_at DESC LIMIT 200`
  );
  return success(res, rows);
});

const listAllPrebookings = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT pb.*, c.crop_name, uc.full_name AS customer_name, uf.full_name AS farmer_name
     FROM pre_bookings pb
     JOIN crops c ON c.id = pb.crop_id
     JOIN customers cu ON cu.id = pb.customer_id JOIN users uc ON uc.id = cu.user_id
     JOIN farmers f ON f.id = pb.farmer_id JOIN users uf ON uf.id = f.user_id
     ORDER BY pb.created_at DESC LIMIT 200`
  );
  return success(res, rows);
});

const listComplaints = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT co.*, u1.full_name AS raised_by_name, u2.full_name AS against_name
     FROM complaints co
     JOIN users u1 ON u1.id = co.raised_by_user_id
     LEFT JOIN users u2 ON u2.id = co.against_user_id
     ORDER BY co.created_at DESC`
  );
  return success(res, rows);
});

const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, adminNotes } = req.body;
  if (!['open', 'investigating', 'resolved', 'dismissed'].includes(status)) return error(res, 'Invalid status.', 422);
  await pool.query(
    'UPDATE complaints SET status = :status, admin_notes = :adminNotes WHERE id = :id',
    { status, adminNotes: adminNotes || null, id: req.params.id }
  );
  return success(res, null, 'Complaint updated.');
});

// Section 17: manage categories & locations
const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, description } = req.body;
  if (!name || !slug) return error(res, 'Name and slug are required.', 422);
  await pool.query('INSERT INTO categories (name, slug, description) VALUES (:name, :slug, :description)', { name, slug, description: description || null });
  return success(res, null, 'Category created.', 201);
});

const createLocation = asyncHandler(async (req, res) => {
  const { state, district } = req.body;
  if (!state || !district) return error(res, 'State and district are required.', 422);
  await pool.query('INSERT IGNORE INTO locations (state, district) VALUES (:state, :district)', { state, district });
  return success(res, null, 'Location added.', 201);
});

module.exports = {
  getDashboardStats, listFarmers, listCustomers, updateUserStatus, verifyFarmer,
  listAllCrops, listAllOrders, listAllPrebookings, listComplaints, updateComplaintStatus,
  createCategory, createLocation
};
