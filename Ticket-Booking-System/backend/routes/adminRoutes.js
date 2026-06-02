const express = require('express');
const {
  getAgentPerformance,
  getPendingHoldRequests,
  getSuperAdminStats,
  getReports
} = require('../controllers/admin.controller');
const { protect, authorizeRoles } = require('../middleware/rbac.middleware');

const router = express.Router();

// Department Admin routes
router.get('/admin/performance', protect, authorizeRoles('department_admin'), getAgentPerformance);
router.get('/admin/hold-requests', protect, authorizeRoles('department_admin'), getPendingHoldRequests);
router.get('/admin/reports', protect, authorizeRoles('department_admin', 'super_admin'), getReports);

// Super Admin routes
router.get('/super-admin/stats', protect, authorizeRoles('super_admin'), getSuperAdminStats);

module.exports = router;