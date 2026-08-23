// ============================================================
// Pre-Booking Controller -> section 10 (core innovation)
// ============================================================
const PrebookingModel = require('../models/prebookingModel');
const CropModel = require('../models/cropModel');
const UserModel = require('../models/userModel');
const ProductModel = require('../models/productModel');
const { createNotification } = require('../utils/notify');
const { success, error, asyncHandler } = require('../utils/response');

const createPrebooking = asyncHandler(async (req, res) => {
  const customer = await UserModel.findCustomerByUserId(req.user.id);
  if (!customer) return error(res, 'Customer profile not found.', 404);

  const { cropId, quantityKg } = req.body;
  if (!cropId || !quantityKg || quantityKg <= 0) {
    return error(res, 'A valid cropId and quantityKg (> 0) are required.', 422);
  }

  try {
    const { id, farmerUserId } = await PrebookingModel.createBooking({
      customerId: customer.id, cropId, quantityKg: parseFloat(quantityKg)
    });

    await ProductModel.syncFromCrop(cropId);

    const crop = await CropModel.findById(cropId);
    if (farmerUserId) {
      await createNotification(
        farmerUserId, 'new_prebooking', 'New Pre-Booking Received',
        `${customer.full_name || 'A customer'} pre-booked ${quantityKg}kg of ${crop.crop_name}.`,
        'prebooking', id
      );
    }

    const booking = await PrebookingModel.findById(id);
    return success(res, booking, 'Pre-booking request confirmed.', 201);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    throw err;
  }
});

const cancelPrebooking = asyncHandler(async (req, res) => {
  const customer = await UserModel.findCustomerByUserId(req.user.id);
  if (!customer) return error(res, 'Customer profile not found.', 404);

  const booking = await PrebookingModel.findById(req.params.id);
  if (!booking || booking.customer_id !== customer.id) return error(res, 'Booking not found.', 404);

  try {
    await PrebookingModel.cancelBooking(req.params.id, { byUserId: req.user.id });
    await ProductModel.syncFromCrop(booking.crop_id);

    const crop = await CropModel.findById(booking.crop_id);
    const [farmerRow] = await require('../config/db').query(
      'SELECT user_id FROM farmers WHERE id = :farmerId', { farmerId: booking.farmer_id }
    );
    if (farmerRow[0]) {
      await createNotification(
        farmerRow[0].user_id, 'prebooking_cancelled', 'Pre-Booking Cancelled',
        `A pre-booking of ${booking.quantity_kg}kg for ${crop.crop_name} was cancelled by the customer.`,
        'prebooking', booking.id
      );
    }

    return success(res, null, 'Pre-booking cancelled and quantity released.');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    throw err;
  }
});

const farmerConfirmPrebooking = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);

  const booking = await PrebookingModel.findById(req.params.id);
  if (!booking || booking.farmer_id !== farmer.id) return error(res, 'Booking not found.', 404);

  await PrebookingModel.updateStatus(req.params.id, farmer.id, 'confirmed');

  const [customerRow] = await require('../config/db').query(
    'SELECT user_id FROM customers WHERE id = :customerId', { customerId: booking.customer_id }
  );
  if (customerRow[0]) {
    await createNotification(
      customerRow[0].user_id, 'prebooking_confirmed', 'Pre-Booking Confirmed',
      `Your pre-booking of ${booking.quantity_kg}kg has been confirmed by the farmer.`,
      'prebooking', booking.id
    );
  }

  return success(res, null, 'Pre-booking confirmed.');
});

const getMyBookingsAsCustomer = asyncHandler(async (req, res) => {
  const customer = await UserModel.findCustomerByUserId(req.user.id);
  if (!customer) return error(res, 'Customer profile not found.', 404);
  const bookings = await PrebookingModel.findByCustomer(customer.id);
  return success(res, bookings);
});

const getMyBookingsAsFarmer = asyncHandler(async (req, res) => {
  const farmer = await UserModel.findFarmerByUserId(req.user.id);
  if (!farmer) return error(res, 'Farmer profile not found.', 404);
  const bookings = await PrebookingModel.findByFarmer(farmer.id);
  return success(res, bookings);
});

// Section 10: dashboard summary — expected/booked/remaining/customers.
const getCropBookingSummary = asyncHandler(async (req, res) => {
  const crop = await CropModel.findById(req.params.cropId);
  if (!crop) return error(res, 'Crop not found.', 404);

  const summary = await PrebookingModel.findByCropSummary(req.params.cropId);
  return success(res, {
    cropName: crop.crop_name,
    expectedQuantityKg: crop.estimated_quantity_kg,
    availableForPrebookingKg: crop.available_for_prebooking_kg,
    prebookedKg: crop.prebooked_quantity_kg,
    remainingKg: Math.max(0, crop.available_for_prebooking_kg - crop.prebooked_quantity_kg),
    numberOfCustomers: summary.customerCount
  });
});

module.exports = {
  createPrebooking, cancelPrebooking, farmerConfirmPrebooking,
  getMyBookingsAsCustomer, getMyBookingsAsFarmer, getCropBookingSummary
};
