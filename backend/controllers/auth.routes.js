const express = require('express');
const {
  requestVerification,
  verifyEmail,
  sendOtp,
  verifyOtp,
  login,
  getMe,
  adminCreateUser,
  adminResetPassword,
  changePassword,
  UptadeProfile,
  forgotPassword,
  resetPassword
} = require('../controllers/auth.controller');
const { protect, authorizeRoles } = require('../middleware/rbac.middleware');

const router = express.Router();

router.post('/request-verification', requestVerification);
router.post('/send-otp',             sendOtp);
router.post('/verify-otp',           verifyOtp);
router.post('/login',                login);
router.post('/forgot-password', forgotPassword);

router.put('/reset-password/:token', resetPassword);
router.get('/me',                    protect, getMe);
router.put('/change-password',       protect, changePassword);
router.put('/update-profile',        protect, UptadeProfile);
router.post('/admin/create-user',    protect, authorizeRoles('super_admin', 'department_admin'), adminCreateUser);
router.put('/admin/reset-password',  protect, authorizeRoles('super_admin', 'department_admin'), adminResetPassword);

module.exports = router;