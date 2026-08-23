// ============================================================
// Analytics Model -> sections 15 & 16
// Aggregation queries feeding Chart.js on the frontend.
// Real vs sample data is always explicitly flagged.
// ============================================================
const pool = require('../config/db');

const AnalyticsModel = {
  // ---------------- Platform-wide demand analytics (section 15) ----------------
  async topDemandedCrops(limit = 10) {
    const [rows] = await pool.query(
      `SELECT cm.crop_name, AVG(md.demand_score) AS avgDemand, MIN(md.is_sample_data) AS isSample
       FROM market_demand md JOIN crop_master cm ON cm.id = md.crop_master_id
       GROUP BY cm.crop_name ORDER BY avgDemand DESC LIMIT :limit`,
      { limit }
    );
    return rows;
  },

  async monthlyOrders(months = 6) {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS orderCount, COALESCE(SUM(total_amount),0) AS totalRevenue
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
       GROUP BY month ORDER BY month ASC`,
      { months }
    );
    return rows;
  },

  async prebookingQuantityByCrop(limit = 10) {
    const [rows] = await pool.query(
      `SELECT c.crop_name, SUM(pb.quantity_kg) AS totalBookedKg
       FROM pre_bookings pb JOIN crops c ON c.id = pb.crop_id
       WHERE pb.status IN ('pending','confirmed','converted_to_order')
       GROUP BY c.crop_name ORDER BY totalBookedKg DESC LIMIT :limit`,
      { limit }
    );
    return rows;
  },

  async cropDemandBySeason() {
    const [rows] = await pool.query(
      `SELECT season, cm.crop_name, AVG(demand_score) AS avgDemand, MIN(is_sample_data) AS isSample
       FROM market_demand md JOIN crop_master cm ON cm.id = md.crop_master_id
       WHERE season IS NOT NULL
       GROUP BY season, cm.crop_name ORDER BY season, avgDemand DESC`
    );
    return rows;
  },

  async upcomingDemand(limit = 10) {
    // Approximates "upcoming demand" using pre-booking activity on crops not yet harvested.
    const [rows] = await pool.query(
      `SELECT c.crop_name, SUM(pb.quantity_kg) AS upcomingBookedKg, c.expected_harvest_date
       FROM pre_bookings pb JOIN crops c ON c.id = pb.crop_id
       WHERE c.status IN ('planned','growing','ready_for_harvest') AND pb.status IN ('pending','confirmed')
       GROUP BY c.id ORDER BY c.expected_harvest_date ASC LIMIT :limit`,
      { limit }
    );
    return rows;
  },

  // ---------------- Farmer-specific analytics (section 16) ----------------
  async farmerCropPerformance(farmerId) {
    const [rows] = await pool.query(
      `SELECT crop_name, status, estimated_quantity_kg, actual_quantity_kg, sold_quantity_kg,
              prebooked_quantity_kg, expected_harvest_date, actual_harvest_date
       FROM crops WHERE farmer_id = :farmerId ORDER BY created_at DESC`,
      { farmerId }
    );
    return rows;
  },

  async farmerPrebookingRate(farmerId) {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS totalBookings,
         SUM(CASE WHEN status IN ('confirmed','converted_to_order') THEN 1 ELSE 0 END) AS confirmedBookings,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledBookings
       FROM pre_bookings WHERE farmer_id = :farmerId`,
      { farmerId }
    );
    return rows[0];
  },

  async farmerMonthlySales(farmerId, months = 6) {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS orderCount, COALESCE(SUM(total_amount),0) AS revenue
       FROM orders
       WHERE farmer_id = :farmerId AND created_at >= DATE_SUB(CURDATE(), INTERVAL :months MONTH)
       GROUP BY month ORDER BY month ASC`,
      { farmerId, months }
    );
    return rows;
  },

  async farmerOrderSummary(farmerId) {
    const [rows] = await pool.query(
      `SELECT
         COUNT(*) AS totalOrders,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completedOrders,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelledOrders,
         COALESCE(SUM(CASE WHEN status = 'completed' THEN total_amount ELSE 0 END),0) AS completedRevenue
       FROM orders WHERE farmer_id = :farmerId`,
      { farmerId }
    );
    return rows[0];
  }
};

module.exports = AnalyticsModel;
