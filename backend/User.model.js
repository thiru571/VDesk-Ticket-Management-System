const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    // match: [/^[^\s@]+@vdartinc\.com$/i, 'Only @vdartinc.com emails are accepted'] // Disabled for testing
  },
  mobileNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  password: {
    type: String,
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default
  },
  userType: {
    type: String,
    enum: ['employee', 'staff'],
    required: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'department_admin', 'agent'],
    required: function () { return this.userType === 'staff'; }
  },
  agentRole: {
    type: String,
    enum: ['it_helpdesk', 'it_support'],
    required: false
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
  isApproved: { 
    type: Boolean,
    default: false
  },
  isActive: { 
    type: Boolean,
    default: true
  },
  shift: {
    type: String,
    enum: ['Morning', 'Mid', 'Night']
  },
  designation: { type: String, trim: true },
  employeeId: { type: String, unique: true, sparse: true }, // Optional, for internal use
  avatar: { type: String, default: 'no-avatar.jpg' },
  preferredContact: {
    type: String,
    enum: ['email', 'phone', 'slack', 'portal'],
    default: 'portal'
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    portal: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  location: {
    branch: String,
    desk: String
  },
  currentWorkload: { type: Number, default: 0 }, // For agents
  expertise: [{ type: String }], // For agents, e.g., ['IT', 'Network']
  liveStatus: {
    type: String,
    enum: ['available', 'on_site', 'remote', 'away', 'offline'],
    default: 'offline'
  },
  onSiteTicket: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }, // If agent is on-site for a ticket
  lastStatusUpdate: { type: Date },
  lastLogin: { type: Date },
  stats: {
    totalRaised: { type: Number, default: 0 },
    totalResolved: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 }
  },
  otp: { type: String, select: false },
  otpExpiry: { type: Date, select: false },
  orgLevel: { type: Number, min: 1, max: 5, default: 1 }, // 1: Employee, 5: CEO
  executiveStatus: { type: Boolean, default: false } // For quick checks for VIPs
}, { timestamps: true });

// Encrypt password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare user password
UserSchema.methods.comparePassword = async function (enteredPassword) {
  if (!this.password) return false; // No password set for this user
  return await bcrypt.compare(enteredPassword, this.password);
};

// Virtual for full role description
UserSchema.virtual('fullRole').get(function() {
  if (this.userType === 'employee') return 'Employee';
  return this.role.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
});

module.exports = mongoose.model('User', UserSchema);