// ============================================================
// Farm Controller -> section 5 (Farm Profile)
// Only the owning farmer can create/update/delete their farms.
// ============================================================
const FarmModel = require('../models/farmModel');
const UserModel = require('../models/userModel');
const { success, error, asyncHandler } = require('../utils/response');

// Helper: resolve farmers.id from the logged-in user id
async function getFarmerIdOrFail(req, res) {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) {
    error(res, 'Farmer profile not found for this account.', 404);
    return null;
  }
  return farmer.id;
}

const createFarm = asyncHandler(async (req, res) => {
  const farmerId = await getFarmerIdOrFail(req, res);
  if (!farmerId) return;

  const { farmName, location, district, state, farmArea, soilType, irrigationType, waterAvailability, farmingExperienceYears } = req.body;
  if (!farmName || !farmArea) return error(res, 'Farm name and farm area are required.', 422);

  const id = await FarmModel.create(farmerId, {
    farmName, location, district, state, farmArea,
    soilType: soilType || null,
    irrigationType: irrigationType || null,
    waterAvailability: waterAvailability || 'medium',
    farmingExperienceYears: farmingExperienceYears || 0
  });

  const farm = await FarmModel.findById(id);
  return success(res, farm, 'Farm profile created successfully.', 201);
});

const getMyFarms = asyncHandler(async (req, res) => {
  const farmerId = await getFarmerIdOrFail(req, res);
  if (!farmerId) return;
  const farms = await FarmModel.findAllByFarmer(farmerId);
  return success(res, farms);
});

const getFarmById = asyncHandler(async (req, res) => {
  const farmerId = await getFarmerIdOrFail(req, res);
  if (!farmerId) return;
  const farm = await FarmModel.findByIdAndFarmer(req.params.id, farmerId);
  if (!farm) return error(res, 'Farm not found.', 404);
  return success(res, farm);
});

const updateFarm = asyncHandler(async (req, res) => {
  const farmerId = await getFarmerIdOrFail(req, res);
  if (!farmerId) return;

  const existing = await FarmModel.findByIdAndFarmer(req.params.id, farmerId);
  if (!existing) return error(res, 'Farm not found or you do not have permission to edit it.', 404);

  const merged = { ...existing, ...req.body };
  await FarmModel.update(req.params.id, farmerId, {
    farmName: merged.farmName ?? merged.farm_name,
    location: merged.location,
    district: merged.district,
    state: merged.state,
    farmArea: merged.farmArea ?? merged.farm_area,
    soilType: merged.soilType ?? merged.soil_type,
    irrigationType: merged.irrigationType ?? merged.irrigation_type,
    waterAvailability: merged.waterAvailability ?? merged.water_availability,
    farmingExperienceYears: merged.farmingExperienceYears ?? merged.farming_experience_years
  });

  const updated = await FarmModel.findById(req.params.id);
  return success(res, updated, 'Farm profile updated successfully.');
});

const deleteFarm = asyncHandler(async (req, res) => {
  const farmerId = await getFarmerIdOrFail(req, res);
  if (!farmerId) return;
  const existing = await FarmModel.findByIdAndFarmer(req.params.id, farmerId);
  if (!existing) return error(res, 'Farm not found or you do not have permission to delete it.', 404);
  await FarmModel.delete(req.params.id, farmerId);
  return success(res, null, 'Farm deleted successfully.');
});

module.exports = { createFarm, getMyFarms, getFarmById, updateFarm, deleteFarm, getFarmerIdOrFail };
