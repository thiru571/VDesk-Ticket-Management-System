const AuditLog = require('../models/AuditLog.model');

// Get all audit logs
const getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(500);

    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAuditLogs
};