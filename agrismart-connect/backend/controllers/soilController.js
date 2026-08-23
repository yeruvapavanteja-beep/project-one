// ============================================================
// Soil Test Controller -> section 6 (Soil Analysis)
// ============================================================
const SoilTestModel = require('../models/soilTestModel');
const FarmModel = require('../models/farmModel');
const UserModel = require('../models/userModel');
const { analyzeSoil } = require('../services/soilAnalysisService');
const { success, error, asyncHandler } = require('../utils/response');

const submitSoilTest = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);

  const { farmId, soilPh, nitrogen, phosphorus, potassium, organicMatter, soilType, waterAvailability, farmAreaTested } = req.body;
  if (!farmId || soilPh == null) return error(res, 'Farm and soil pH are required.', 422);

  const farm = await FarmModel.findByIdAndFarmer(farmId, farmer.id);
  if (!farm) return error(res, 'Farm not found or does not belong to you.', 404);

  const analysis = analyzeSoil({
    soilPh, nitrogen, phosphorus, potassium, organicMatter,
    soilType: soilType || farm.soil_type,
    waterAvailability: waterAvailability || farm.water_availability
  });

  const id = await SoilTestModel.create(farmId, {
    soilPh, nitrogen, phosphorus, potassium, organicMatter,
    soilType: soilType || farm.soil_type,
    waterAvailability: waterAvailability || farm.water_availability,
    farmAreaTested: farmAreaTested || farm.farm_area,
    summaryCondition: analysis.condition,
    notes: analysis.observations.join(' ')
  });

  const record = await SoilTestModel.findById(id);
  return success(res, { soilTest: record, analysis }, 'Soil analysis submitted successfully.', 201);
});

const getFarmSoilTests = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);

  const farm = await FarmModel.findByIdAndFarmer(req.params.farmId, farmer.id);
  if (!farm) return error(res, 'Farm not found.', 404);

  const tests = await SoilTestModel.findAllByFarm(req.params.farmId);
  return success(res, tests);
});

module.exports = { submitSoilTest, getFarmSoilTests };
