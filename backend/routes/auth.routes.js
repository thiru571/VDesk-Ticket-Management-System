const express = require('express');
const router = express.Router();
const {
  requestVerification, verifyEmail,
  sendOtp, verifyOtp, login, getMe,
  adminCreateUser, adminResetPassword,
  changePassword
} = require('../controllers/auth.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

const otpLimiter = rateLimit({
  windowMs:  60 * 1000, // 0.5 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { success: false, message: 'Too many requests, please try again after 1 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public
router.post('/request-verification', requestVerification);
router.get('/verify-email', verifyEmail);
router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login); 
router.put(
  '/change-password',
  protect,
  changePassword
);// kept for admin password login

// Private
router.get('/me', protect, getMe);

// Admin only
router.post('/admin/create-user', protect, authorize('admin'), adminCreateUser);
router.put('/admin/reset-password', protect, authorize('admin'), adminResetPassword);


module.exports = router;
