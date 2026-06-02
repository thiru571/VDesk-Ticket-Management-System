const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  isActive: { type: Boolean, default: true },
  description: { type: String, trim: true },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Department Admin
}, { timestamps: true });

module.exports = mongoose.model('Department', DepartmentSchema);