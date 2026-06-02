const express = require('express');
const router = express.Router();
const { getAgentPerformance } = require('../controllers/analytics.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.get('/agent-performance', protect, authorize('admin'), getAgentPerformance);

module.exports = router;
