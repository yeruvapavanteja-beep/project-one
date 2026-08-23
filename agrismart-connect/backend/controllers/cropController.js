// ============================================================
// Crop Controller -> section 8 (Crop Management)
// Rule (section 23 #6): only farmers can create/update their own crops.
// ============================================================
const CropModel = require('../models/cropModel');
const FarmModel = require('../models/farmModel');
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const { success, error, asyncHandler } = require('../utils/response');

const VALID_STATUSES = ['planned', 'growing', 'ready_for_harvest', 'harvested', 'sold', 'completed'];

async function getFarmerOrFail(req, res) {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) {
    error(res, 'Farmer profile not found for this account.', 404);
    return null;
  }
  return farmer;
}

const createCrop = asyncHandler(async (req, res) => {
  const farmer = await getFarmerOrFail(req, res);
  if (!farmer) return;

  const { farmId, cropName, variety, categoryId, cropMasterId, areaCultivated, plantingDate,
    expectedHarvestDate, estimatedQuantityKg, expectedPricePerKg, description } = req.body;

  if (!farmId || !cropName) return error(res, 'Farm and crop name are required.', 422);

  const farm = await FarmModel.findByIdAndFarmer(farmId, farmer.id);
  if (!farm) return error(res, 'Farm not found or does not belong to you.', 404);

  const coverImage = req.file ? `/uploads/crops/${req.file.filename}` : null;

  const id = await CropModel.create(farmer.id, farmId, {
    cropName, variety, categoryId, cropMasterId, areaCultivated, plantingDate,
    expectedHarvestDate, estimatedQuantityKg, expectedPricePerKg, description, coverImage
  });

  const crop = await CropModel.findById(id);
  return success(res, crop, 'Crop added successfully.', 201);
});

const getMyCrops = asyncHandler(async (req, res) => {
  const farmer = await getFarmerOrFail(req, res);
  if (!farmer) return;
  const crops = await CropModel.findAllByFarmer(farmer.id, req.query.status || null);
  return success(res, crops);
});

const getCropById = asyncHandler(async (req, res) => {
  const farmer = await getFarmerOrFail(req, res);
  if (!farmer) return;
  const crop = await CropModel.findByIdAndFarmer(req.params.id, farmer.id);
  if (!crop) return error(res, 'Crop not found.', 404);
  return success(res, crop);
});

const updateCrop = asyncHandler(async (req, res) => {
  const farmer = await getFarmerOrFail(req, res);
  if (!farmer) return;

  const existing = await CropModel.findByIdAndFarmer(req.params.id, farmer.id);
  if (!existing) return error(res, 'Crop not found or you do not have permission to edit it.', 404);

  const fields = { ...req.body };
  if (req.file) fields.cover_image = `/uploads/crops/${req.file.filename}`;

  // Map camelCase body keys to snake_case columns where needed
  const columnMap = {
    cropName: 'crop_name', variety: 'variety', categoryId: 'category_id', areaCultivated: 'area_cultivated',
    plantingDate: 'planting_date', expectedHarvestDate: 'expected_harvest_date',
    actualHarvestDate: 'actual_harvest_date', estimatedQuantityKg: 'estimated_quantity_kg',
    actualQuantityKg: 'actual_quantity_kg', expectedPricePerKg: 'expected_price_per_kg',
    availableForPrebookingKg: 'available_for_prebooking_kg', description: 'description', isPublic: 'is_public'
  };
  const dbFields = {};
  for (const [k, v] of Object.entries(fields)) {
    dbFields[columnMap[k] || k] = v;
  }

  // Safety check: cannot set available_for_prebooking_kg below what's already booked
  if (dbFields.available_for_prebooking_kg != null &&
      parseFloat(dbFields.available_for_prebooking_kg) < parseFloat(existing.prebooked_quantity_kg)) {
    return error(res, `Cannot set available quantity below the ${existing.prebooked_quantity_kg}kg already pre-booked.`, 422);
  }

  await CropModel.update(req.params.id, farmer.id, dbFields);

  // Keep the marketplace product listing (if any) in sync with quantity/price changes.
  await ProductModel.syncFromCrop(req.params.id);

  const updated = await CropModel.findById(req.params.id);
  return success(res, updated, 'Crop updated successfully.');
});

const updateCropStatus = asyncHandler(async (req, res) => {
  const farmer = await getFarmerOrFail(req, res);
  if (!farmer) return;

  const { status } = req.body;
  if (!VALID_STATUSES.includes(status)) return error(res, `Status must be one of: ${VALID_STATUSES.join(', ')}`, 422);

  const existing = await CropModel.findByIdAndFarmer(req.params.id, farmer.id);
  if (!existing) return error(res, 'Crop not found.', 404);

  await CropModel.update(req.params.id, farmer.id, { status });
  await ProductModel.syncFromCrop(req.params.id);

  const updated = await CropModel.findById(req.params.id);
  return success(res, updated, `Crop status updated to "${status}".`);
});

const deleteCrop = asyncHandler(async (req, res) => {
  const farmer = await getFarmerOrFail(req, res);
  if (!farmer) return;
  const existing = await CropModel.findByIdAndFarmer(req.params.id, farmer.id);
  if (!existing) return error(res, 'Crop not found.', 404);
  if (parseFloat(existing.prebooked_quantity_kg) > 0) {
    return error(res, 'Cannot delete a crop that has active pre-bookings. Cancel bookings first.', 409);
  }
  await CropModel.delete(req.params.id, farmer.id);
  return success(res, null, 'Crop deleted successfully.');
});

// -------------------- Public endpoints (customer-facing) --------------------
const getPublicUpcomingCrops = asyncHandler(async (req, res) => {
  const { district, category, cropName, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const crops = await CropModel.findPublicUpcoming({ district, category, cropName, limit: Number(limit), offset: Number(offset) });
  return success(res, crops);
});

const getPublicCropById = asyncHandler(async (req, res) => {
  const crop = await CropModel.findPublicById(req.params.id);
  if (!crop) return error(res, 'Crop not found or not public.', 404);
  return success(res, crop);
});

module.exports = {
  createCrop, getMyCrops, getCropById, updateCrop, updateCropStatus, deleteCrop,
  getPublicUpcomingCrops, getPublicCropById
};
