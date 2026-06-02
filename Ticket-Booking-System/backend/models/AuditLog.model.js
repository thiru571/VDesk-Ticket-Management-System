const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  event: {
    type: String,
    enum: ['OTP_SENT', 'OTP_SUCCESS', 'OTP_FAILED', 'OTP_LOCKED', 'LOGIN_PASSWORD'],
    required: true
  },
  email: { type: String, required: true },
  ip: { type: String, default: 'unknown' },
  userAgent: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} } // extra details
}, {
  timestamps: true
});

auditLogSchema.index({ email: 1, createdAt: -1 });
auditLogSchema.index({ event: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
