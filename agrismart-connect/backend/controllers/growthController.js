// ============================================================
// Growth Monitoring Controller -> section 9
// ============================================================
const GrowthModel = require('../models/growthModel');
const CropModel = require('../models/cropModel');
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const { createNotification } = require('../utils/notify');
const { success, error, asyncHandler } = require('../utils/response');
const pool = require('../config/db');

const GROWTH_STAGES = ['seedling', 'vegetative', 'flowering', 'fruit_development', 'ready_for_harvest'];

const addGrowthUpdate = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);

  const crop = await CropModel.findByIdAndFarmer(req.params.cropId, farmer.id);
  if (!crop) return error(res, 'Crop not found or does not belong to you.', 404);

  const { growthPercentage, growthStage, healthStatus, notes, updateDate } = req.body;
  if (!GROWTH_STAGES.includes(growthStage)) {
    return error(res, `Growth stage must be one of: ${GROWTH_STAGES.join(', ')}`, 422);
  }
  const pct = Math.max(0, Math.min(100, parseInt(growthPercentage, 10) || 0));

  const image = req.file ? `/uploads/growth/${req.file.filename}` : null;

  const id = await GrowthModel.create(req.params.cropId, {
    image, growthPercentage: pct, growthStage, healthStatus, notes, updateDate
  });

  // Keep the crop's own snapshot fields current so dashboards/marketplace stay accurate.
  await CropModel.updateGrowth(req.params.cropId, farmer.id, { growthPercentage: pct, growthStage });

  // Auto-flip status when growth reaches "ready for harvest"
  if (growthStage === 'ready_for_harvest' && crop.status !== 'ready_for_harvest') {
    await CropModel.update(req.params.cropId, farmer.id, { status: 'ready_for_harvest' });
  }
  await ProductModel.syncFromCrop(req.params.cropId);

  // Notify customers who pre-booked this crop that harvest is approaching.
  if (growthStage === 'ready_for_harvest' || growthStage === 'fruit_development') {
    const [bookers] = await pool.query(
      `SELECT DISTINCT u.id as user_id FROM pre_bookings pb
       JOIN customers cu ON cu.id = pb.customer_id
       JOIN users u ON u.id = cu.user_id
       WHERE pb.crop_id = :cropId AND pb.status IN ('pending','confirmed')`,
      { cropId: req.params.cropId }
    );
    for (const b of bookers) {
      await createNotification(
        b.user_id, 'harvest_approaching', 'Harvest Update',
        `${crop.crop_name} you pre-booked is now at the "${growthStage.replace('_', ' ')}" stage.`,
        'crop', req.params.cropId
      );
    }
  }

  const update = { id, growthPercentage: pct, growthStage, healthStatus, notes, image };
  return success(res, update, 'Growth update recorded successfully.', 201);
});

const getGrowthTimeline = asyncHandler(async (req, res) => {
  const updates = await GrowthModel.findAllByCrop(req.params.cropId);
  return success(res, updates);
});

module.exports = { addGrowthUpdate, getGrowthTimeline };
