// ============================================================
// Auth Controller
// Handles registration & login for farmer/customer, admin login,
// logout (client-side token discard + optional blacklist hook),
// and a forgot-password flow (token generation structure only -
// actual email delivery is left as an integration point).
// ============================================================
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const UserModel = require('../models/userModel');
const { signToken } = require('../config/jwt');
const { success, error, asyncHandler } = require('../utils/response');

const SALT_ROUNDS = 12;

// --------------------------------------------------------
// POST /api/auth/register/farmer
// --------------------------------------------------------
const registerFarmer = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, location, district, state, farmArea, farmerType } = req.body;

  const existing = await UserModel.findByEmail(email);
  if (existing) return error(res, 'An account with this email already exists.', 409);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = await UserModel.createUser({ fullName, email, phone, passwordHash, role: 'farmer' });
  await UserModel.createFarmerProfile(userId, {
    location: location || null,
    district: district || null,
    state: state || null,
    farmArea: farmArea || null,
    farmerType: farmerType || 'smallholder'
  });

  const token = signToken({ id: userId, role: 'farmer' });
  return success(res, {
    token,
    user: { id: userId, fullName, email, role: 'farmer' }
  }, 'Farmer account created successfully.', 201);
});

// --------------------------------------------------------
// POST /api/auth/register/customer
// --------------------------------------------------------
const registerCustomer = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, location, address } = req.body;

  const existing = await UserModel.findByEmail(email);
  if (existing) return error(res, 'An account with this email already exists.', 409);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = await UserModel.createUser({ fullName, email, phone, passwordHash, role: 'customer' });
  await UserModel.createCustomerProfile(userId, { location: location || null, address: address || null });

  const token = signToken({ id: userId, role: 'customer' });
  return success(res, {
    token,
    user: { id: userId, fullName, email, role: 'customer' }
  }, 'Customer account created successfully.', 201);
});

// --------------------------------------------------------
// POST /api/auth/login  (farmer + customer)
// --------------------------------------------------------
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await UserModel.findByEmail(email);
  if (!user) return error(res, 'Invalid email or password.', 401);
  if (user.status === 'suspended') return error(res, 'This account has been suspended. Contact support.', 403);

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return error(res, 'Invalid email or password.', 401);

  await UserModel.updateLastLogin(user.id);
  const token = signToken({ id: user.id, role: user.role });

  return success(res, {
    token,
    user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role }
  }, 'Login successful.');
});

// --------------------------------------------------------
// POST /api/auth/admin/login
// Same table, but this endpoint only accepts role='admin' so the
// admin login page can't be used to authenticate other roles.
// --------------------------------------------------------
const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await UserModel.findByEmail(email);
  if (!user || user.role !== 'admin') return error(res, 'Invalid admin credentials.', 401);

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return error(res, 'Invalid admin credentials.', 401);

  await UserModel.updateLastLogin(user.id);
  const token = signToken({ id: user.id, role: 'admin' });

  return success(res, {
    token,
    user: { id: user.id, fullName: user.full_name, email: user.email, role: 'admin' }
  }, 'Admin login successful.');
});

// --------------------------------------------------------
// POST /api/auth/logout
// JWTs are stateless; logout is primarily a client-side action
// (discard the token). This endpoint exists for a consistent API
// and as a hook point for a future token-blacklist/session store.
// --------------------------------------------------------
const logout = asyncHandler(async (req, res) => {
  return success(res, null, 'Logged out successfully.');
});

// --------------------------------------------------------
// POST /api/auth/forgot-password
// Generates a reset token structure. Actual email sending should
// be wired up to a mail provider (e.g. Nodemailer/SendGrid) later;
// for now the token is returned in dev mode only for testing.
// --------------------------------------------------------
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await UserModel.findByEmail(email);

  // Always respond the same way whether or not the email exists,
  // to avoid leaking which emails are registered.
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    await UserModel.setResetToken(user.id, token, expires);

    // TODO: send `token` via email using a mail provider.
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔑 Password reset token for ${email}: ${token}`);
    }
  }

  return success(res, null, 'If an account with that email exists, a password reset link has been sent.');
});

// --------------------------------------------------------
// POST /api/auth/reset-password
// --------------------------------------------------------
const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;
  const user = await UserModel.findByResetToken(token);
  if (!user) return error(res, 'This reset link is invalid or has expired.', 400);

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await UserModel.updatePassword(user.id, passwordHash);

  return success(res, null, 'Password has been reset successfully. You can now log in.');
});

// --------------------------------------------------------
// GET /api/auth/me
// --------------------------------------------------------
const getCurrentUser = asyncHandler(async (req, res) => {
  const user = await UserModel.findById(req.user.id);
  if (!user) return error(res, 'User not found.', 404);

  let profile = null;
  if (user.role === 'farmer') profile = await UserModel.findFarmerByUserId(user.id);
  if (user.role === 'customer') profile = await UserModel.findCustomerByUserId(user.id);

  const { password_hash, reset_token, reset_token_expires, ...safeUser } = user;
  return success(res, { user: safeUser, profile });
});

module.exports = {
  registerFarmer,
  registerCustomer,
  login,
  adminLogin,
  logout,
  forgotPassword,
  resetPassword,
  getCurrentUser
};
