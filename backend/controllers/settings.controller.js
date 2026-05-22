const Settings = require('../models/Settings.model');

// @desc    Get all settings
// @route   GET /api/settings
// @access  Private/Admin
exports.getSettings = async (req, res, next) => {
  try {
    const settings = await Settings.find();
    res.status(200).json({
      success: true,
      settings
    });
  } catch (err) {
    console.error('❌ getSettings Error:', err);
    next(err);
  }
};

// @desc    Update or create a setting
// @route   POST /api/settings
// @access  Private/Admin
exports.updateSetting = async (req, res, next) => {
  try {
    const { key, value, description } = req.body;
    console.log(`📝 Updating setting: ${key}`, value);
    
    let setting = await Settings.findOne({ key });
    
    if (setting) {
      setting.value = value;
      if (description) setting.description = description;
      setting.updatedBy = req.user?._id;
      // Mark as modified since it's a Mixed type
      setting.markModified('value');
      await setting.save();
    } else {
      setting = await Settings.create({
        key,
        value,
        description,
        updatedBy: req.user?._id
      });
    }

    res.status(200).json({
      success: true,
      setting
    });
  } catch (err) {
    console.error('❌ updateSetting Error:', err);
    next(err);
  }
};

// Helper to get a setting value internally
exports.getSettingValue = async (key, defaultValue) => {
  try {
    const setting = await Settings.findOne({ key });
    return setting ? setting.value : defaultValue;
  } catch (err) {
    return defaultValue;
  }
};
