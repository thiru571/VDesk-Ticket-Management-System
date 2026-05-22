const express = require('express');
const router = express.Router();
const { getSettings, updateSetting } = require('../controllers/settings.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);
router.use(authorize('admin'));

router.get('/', getSettings);
router.post('/', updateSetting);

module.exports = router;
