const express = require('express');
const {
  getUsers, getAgents, getUser, updateUser,
  getUserStats, updateLiveStatus, bulkImportUsers, bulkDeleteUsers
} = require('../controllers/user.controller');
const { protect, authorizeRoles } = require('../middleware/rbac.middleware');
const upload = require('../middleware/upload'); // Assuming multer upload middleware for CSV

const router = express.Router();

router.get('/', protect, authorizeRoles('super_admin'), getUsers); // Only super_admin can get all users
router.get('/agents', protect, authorizeRoles('super_admin', 'department_admin', 'agent'), getAgents); // Staff can get agents
router.get('/:id', protect, authorizeRoles('super_admin', 'department_admin'), getUser); // Super/Dept admin can get user
router.put('/:id', protect, authorizeRoles('super_admin', 'department_admin'), updateUser); // Super/Dept admin can update user
router.get('/:id/stats', protect, getUserStats); // User can get their own stats, admin can get any
router.put('/status', protect, authorizeRoles('agent'), updateLiveStatus); // Only agents can update live status
router.post('/bulk-import', protect, authorizeRoles('super_admin'), upload.single('csvFile'), bulkImportUsers); // Only super_admin can bulk import
router.delete('/bulk-delete', protect, authorizeRoles('super_admin'), bulkDeleteUsers); // Only super_admin can bulk delete

module.exports = router;