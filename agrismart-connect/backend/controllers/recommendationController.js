// ============================================================
// Crop Recommendation Controller -> section 7
// ============================================================
const { generateRecommendations } = require('../services/recommendationEngine');
const RecommendationModel = require('../models/recommendationModel');
const SoilTestModel = require('../models/soilTestModel');
const FarmModel = require('../models/farmModel');
const UserModel = require('../models/userModel');
const { success, error, asyncHandler } = require('../utils/response');

const getRecommendations = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);

  const { farmId, soilTestId, season, waterAvailability, weather } = req.body;

  let soilInput = req.body.soil || null;
  let resolvedWater = waterAvailability;

  // If a saved soil test is referenced, pull its values instead of
  // requiring the farmer to re-type everything.
  if (soilTestId) {
    const test = await SoilTestModel.findById(soilTestId);
    if (test) {
      soilInput = {
        soilPh: parseFloat(test.soil_ph),
        nitrogen: test.nitrogen != null ? parseFloat(test.nitrogen) : null,
        phosphorus: test.phosphorus != null ? parseFloat(test.phosphorus) : null,
        potassium: test.potassium != null ? parseFloat(test.potassium) : null,
        soilType: test.soil_type
      };
      resolvedWater = resolvedWater || test.water_availability;
    }
  }

  let district = null;
  if (farmId) {
    const farm = await FarmModel.findByIdAndFarmer(farmId, farmer.id);
    if (farm) {
      district = farm.district;
      resolvedWater = resolvedWater || farm.water_availability;
    }
  }

  if (!soilInput) return error(res, 'Soil data or a saved soilTestId is required.', 422);
  if (!season) return error(res, 'Season is required (e.g. kharif, rabi, zaid, summer, winter).', 422);

  const results = await generateRecommendations({
    soil: soilInput,
    season,
    waterAvailability: resolvedWater || 'medium',
    weather: weather || null,
    district
  });

  await RecommendationModel.logRun(farmer.id, {
    farmId, soilTestId, season,
    inputSnapshot: { soil: soilInput, season, waterAvailability: resolvedWater, weather },
    results
  });

  return success(res, {
    recommendations: results.slice(0, 10),
    disclaimer: 'These are decision-support suggestions based on the data provided, not a guarantee of yield, profit, or market price.'
  }, 'Crop recommendations generated.');
});

const getRecommendationHistory = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);
  const history = await RecommendationModel.findHistoryByFarmer(farmer.id);
  return success(res, history);
});

module.exports = { getRecommendations, getRecommendationHistory };
