const express = require('express');
const {
  sendOtp, verifyOtp, login, getMe,
  adminCreateUser, adminResetPassword
} = require('../controllers/auth.controller');
const { protect, authorizeRoles } = require('../middleware/rbac.middleware');

const router = express.Router();
router.post('/request-verification', requestVerification);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', login); // For staff password login
router.get('/me', protect, getMe);
router.post('/admin/create-user', protect, authorizeRoles('super_admin', 'department_admin'), adminCreateUser);
router.put('/admin/reset-password', protect, authorizeRoles('super_admin', 'department_admin'), adminResetPassword);

module.exports = router;