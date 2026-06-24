const express = require('express');
const router = express.Router();

const { getAuditLogs } = require('../controllers/audit.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Only Admin can view logs
router.get('/', protect, authorize('admin'), getAuditLogs);

module.exports = router;