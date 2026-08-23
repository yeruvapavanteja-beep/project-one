// ============================================================
// Analytics Controller -> sections 15 & 16
// ============================================================
const AnalyticsModel = require('../models/analyticsModel');
const UserModel = require('../models/userModel');
const { success, error, asyncHandler } = require('../utils/response');

// ---------------- Demand analytics (public-ish; used in farmer dashboard) ----------------
const getDemandAnalytics = asyncHandler(async (req, res) => {
  const [topDemanded, monthlyOrders, prebookingByCrop, demandBySeason, upcomingDemand] = await Promise.all([
    AnalyticsModel.topDemandedCrops(),
    AnalyticsModel.monthlyOrders(),
    AnalyticsModel.prebookingQuantityByCrop(),
    AnalyticsModel.cropDemandBySeason(),
    AnalyticsModel.upcomingDemand()
  ]);

  return success(res, {
    topDemandedCrops: topDemanded,
    monthlyOrders,
    prebookingQuantityByCrop: prebookingByCrop,
    cropDemandBySeason: demandBySeason,
    upcomingDemand,
    note: 'Demand figures derived from real platform activity are marked isSample=false; unmarked/sample figures use seeded demo data until enough real activity accumulates.'
  });
});

// ---------------- Farmer analytics ----------------
const getFarmerAnalytics = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);

  const [cropPerformance, prebookingRate, monthlySales, orderSummary] = await Promise.all([
    AnalyticsModel.farmerCropPerformance(farmer.id),
    AnalyticsModel.farmerPrebookingRate(farmer.id),
    AnalyticsModel.farmerMonthlySales(farmer.id),
    AnalyticsModel.farmerOrderSummary(farmer.id)
  ]);

  return success(res, { cropPerformance, prebookingRate, monthlySales, orderSummary });
});

module.exports = { getDemandAnalytics, getFarmerAnalytics };
