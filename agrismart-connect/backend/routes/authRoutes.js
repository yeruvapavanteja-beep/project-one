// ============================================================
// Auth Routes -> /api/auth
// ============================================================
const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const authController = require('../controllers/authController');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');

const passwordRule = body('password')
  .isLength({ min: 8 })
  .withMessage('Password must be at least 8 characters long.');

// ---------------- Farmer registration ----------------
router.post(
  '/register/farmer',
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('phone').trim().isLength({ min: 7, max: 20 }).withMessage('A valid phone number is required.'),
    passwordRule,
    body('location').optional().trim(),
    body('district').optional().trim(),
    body('state').optional().trim(),
    body('farmArea').optional().isFloat({ min: 0 }).withMessage('Farm area must be a positive number.'),
    body('farmerType').optional().isIn(['smallholder', 'commercial', 'organic', 'mixed'])
  ],
  validate,
  authController.registerFarmer
);

// ---------------- Customer registration ----------------
router.post(
  '/register/customer',
  [
    body('fullName').trim().notEmpty().withMessage('Full name is required.'),
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('phone').trim().isLength({ min: 7, max: 20 }).withMessage('A valid phone number is required.'),
    passwordRule,
    body('location').optional().trim(),
    body('address').optional().trim()
  ],
  validate,
  authController.registerCustomer
);

// ---------------- Login (farmer/customer) ----------------
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  validate,
  authController.login
);

// ---------------- Admin login ----------------
router.post(
  '/admin/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('A valid email is required.'),
    body('password').notEmpty().withMessage('Password is required.')
  ],
  validate,
  authController.adminLogin
);

// ---------------- Logout ----------------
router.post('/logout', authenticate, authController.logout);

// ---------------- Forgot / Reset password ----------------
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail().withMessage('A valid email is required.')],
  validate,
  authController.forgotPassword
);

router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Reset token is required.'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters.')
  ],
  validate,
  authController.resetPassword
);

// ---------------- Current user ----------------
router.get('/me', authenticate, authController.getCurrentUser);

module.exports = router;
