const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const attachmentSchema = new mongoose.Schema({
  filename: String,
  originalName: String,
  mimetype: String,
  size: Number,
  path: String,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedAt: { type: Date, default: Date.now }
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  from: String,
  to: String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String,
  timestamp: { type: Date, default: Date.now }
}, { _id: true });

const priorityAuditSchema = new mongoose.Schema({
  from: String,
  to: String,
  previousScore: Number,
  newScore: Number,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reason: String, // 'auto-rule', 'manual', 'escalation', 'age-bonus'
  timestamp: { type: Date, default: Date.now }
}, { _id: true });

const slaSchema = new mongoose.Schema({
  deadline: Date,
  responseDeadline: Date,
  breached: { type: Boolean, default: false },
  responseBreached: { type: Boolean, default: false },
  breachedAt: Date,
  risk: { type: Number, min: 1, max: 5, default: 1 },
  respondedAt: Date,
  resolvedAt: Date
}, { _id: false });

const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true
  },

  // Core fields
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  category: {
    type: String,
    required: true,
    enum: ['IT', 'HR', 'Finance', 'Admin', 'Operations', 'Marketing', 'Sales', 'Legal', 'Engineering', 'Network', 'Software', 'Hardware', 'Request', 'Replacement', 'Other', 'IT Request', 'Network Issue', 'Software Issue', 'Hardware Issue', 'Email Login Issue', 'HR Needs', 'Payroll', 'Leave Request', 'Benefits', 'Policy Query', 'Recruitment', 'Onboarding', 'Offboarding']
  },
  subCategory: {
    type: String,
    trim: true
  },
  ticketType: {
    type: String,
    enum: ['Network', 'Software', 'Hardware', 'Request', 'Replacement'] 
  },
  source: {
    type: String,
    enum: ['Portal', 'Email', 'Mail','Digital', 'Onboarding'],
    default: 'Portal'
  },
  vpAssigned: {
    type: String,
    enum: ['VP-GICC', 'VP-Bangalore', null],
    default: null
  },
  mobileNumber: String, // Mobile number for the specific ticket context

  // Priority system
  priority: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low'],
    default: 'low'
  },
  prioritySource: {
    type: String,
    enum: ['manual', 'auto', 'escalated'],
    default: 'auto'
  },
  priorityScore: { type: Number, default: 0 },

  // Scoring components (for transparency)
  scoreBreakdown: {
    impactScore: { type: Number, default: 0 },
    urgencyScore: { type: Number, default: 0 },
    slaRiskScore: { type: Number, default: 0 },
    roleModifier: { type: Number, default: 0 },
    queueBonus: { type: Number, default: 0 },
    knowledgeBonus: { type: Number, default: 0 }
  },

  // Status
  status: {
    type: String,
    enum: ['open','assigned','in_progress','reopened','on_hold','resolved','closed', 'pending_confirmation', 'almost_complete','pending'],
    default: 'open'
  },

  // Hold System
  hold: {
    isHoldRequested: { type: Boolean, default: false },
    reason: String,
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: Date,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    deniedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deniedAt: Date,
    denialReason: String,
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  },

  lockedToAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assetId: { type: String, trim: true },
  ticketSource: { 
    type: String, 
    enum: ['Help Desk', 'Mail Ticket', 'Digital', 'Onboard/Offboarding'], 
    default: 'Digital' 
  },
  officeLocation: {
    type: String
  },
  shift: { type: String, enum: ['Morning','Mid','Night', 'morning', 'mid', 'night'] },
  assignedDepartment: {
    type: mongoose.Schema.Types.ObjectId, ref: 'Department'
  },
  holdRequest: {
    requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason:       { type: String },
    status:       { type: String, enum: ['pending','approved','rejected'] },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt:  { type: Date },
    reviewedAt:   { type: Date }
  },
  reassignRequest: {
    requestedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason:       { type: String },
    status:       { type: String, enum: ['pending','approved','rejected'] },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt:  { type: Date },
    reviewedAt:   { type: Date }
  },

  // Impact & Urgency (employee input)
  impactScope: {
    type: String,
    enum: ['just_me', 'team', 'department', 'company'],
    default: 'just_me'
  },
  urgencyLevel: {
    type: String,
    enum: ['flexible', 'today', 'within_hour', 'right_now'],
    default: 'flexible'
  },

  // Work context
  teamName: { type: String, trim: true },

  // Device/context fields (for IT tickets)
  context: {
    deviceType: String,
    os: String,
    assetId: String,
    affectedSystem: String,
    issueStarted: {
      type: String,
      enum: ['just_now', 'within_hour', 'today', 'few_days']
    }
  },

  // People
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedAt: Date,
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  firstResponseAt: Date,
  autoAssigned: { type: Boolean, default: false },

  // Employee contact preference
  preferredContact: {
    type: String,
    enum: ['email', 'phone', 'slack', 'portal'],
    default: 'portal'
  },

  // SLA
  sla: slaSchema,

  // Attachments
  attachments: [attachmentSchema],

  // Tracking
  statusHistory: [statusHistorySchema],
  priorityAudit: [priorityAuditSchema],

  // Reopen tracking
  reopenCount: { type: Number, default: 0 },
  reopenReason: String,
  lastReopenedAt: Date,

  // Email source (if created from Gmail)
  emailSource: {
    messageId: String,
    from: String,
    receivedAt: Date,
    threadId: String
  },

  // Related tickets
  relatedTickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ticket' }],

  // Resolution
  resolution: {
    notes: String,
    type: {
      type: String,
      enum: ['on_site_fix', 'remote_fix', 'guided_employee', 'config_change', 'other']
    },
    resolvedAt: Date,
    pendingConfirmationAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    knowledgeBaseRef: String
  },

  // On-Site Visit Workflow
  onSiteVisit: {
    requestedAt: Date,
    arrivedAt: Date,
    arrivalConfirmedByEmployee: { type: Boolean, default: false },
    completionConfirmedByEmployee: { type: Boolean, default: false },
    visitResolvedAt: Date,
    locationVerified: { type: Boolean, default: false }
  },

  // Feedback
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comment: String,
    submittedAt: Date
  },

  // Expected resolution (set by agent)
  estimatedResolutionTime: Date,

  // Duplicate detection
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  isDuplicate: { type: Boolean, default: false },

  // Internal notes (only agents/admins see)
  internalNotes: String,

  // Tags
  tags: [String],

  // View count
  viewCount: { type: Number, default: 0 },

  // Queue position (within same priority bucket)
  queuePosition: { type: Number, default: 0 }

}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Auto-generate ticket ID
ticketSchema.pre('save', async function (next) {
  if (!this.ticketId) {
    try {
      // Find the ticket with the highest ticketId
      const lastTicket = await mongoose.model('Ticket')
        .findOne({ ticketId: /^TKT-/ })
        .sort({ ticketId: -1 })
        .collation({ locale: 'en', numericOrdering: true });
        
      let nextIdNumber = 1;
      if (lastTicket && lastTicket.ticketId) {
        const match = lastTicket.ticketId.match(/TKT-(\d+)/);
        if (match) {
          nextIdNumber = parseInt(match[1], 10) + 1;
        } else {
          const count = await mongoose.model('Ticket').countDocuments();
          nextIdNumber = count + 1;
        }
      } else {
         const count = await mongoose.model('Ticket').countDocuments();
         nextIdNumber = count + 1;
      }
      this.ticketId = `TKT-${String(nextIdNumber).padStart(5, '0')}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

// Virtuals
ticketSchema.virtual('isOverdue').get(function () {
  if (!this.sla?.deadline) return false;
  if (['resolved', 'closed'].includes(this.status)) return false;
  return new Date() > new Date(this.sla.deadline);
});

ticketSchema.virtual('timeRemaining').get(function () {
  if (!this.sla?.deadline) return null;
  const remaining = new Date(this.sla.deadline) - new Date();
  return Math.max(0, remaining);
});

ticketSchema.virtual('slaScore').get(function() {
  if (this.status === 'resolved' || this.status === 'closed') return 100;
  if (!this.sla?.deadline) return 100;
  
  const created = this.createdAt.getTime();
  const deadline = this.sla.deadline.getTime();
  const now = Date.now();
  
  const totalSlaTime = deadline - created;
  const timeRemaining = deadline - now;
  
  if (timeRemaining <= 0) return 0;
  
  // Calculate percentage based on time remaining vs total allowed SLA time
  const score = Math.max(0, Math.min(100, Math.round((timeRemaining / totalSlaTime) * 100)));
  return score;
});

// SLA Health Status based on Risk Level (1-5) as per README (1)
ticketSchema.virtual('slaStatus').get(function() {
  if (this.status === 'resolved' || this.status === 'closed') return 'Healthy';
  if (this.sla?.breached) return 'Breached';
  
  const risk = this.sla?.risk || 1;
  if (risk >= 4) return 'Critical';
  if (risk === 3) return 'Warning';
  return 'Healthy';
});

ticketSchema.virtual('commentCount', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'ticket',
  count: true
});

// Calculate durations spent in each status
ticketSchema.virtual('durations').get(function() {
  const durations = {
    open: 0,
    assigned: 0,
    in_progress: 0,
    closed: 0
  };

  if (!this.statusHistory || this.statusHistory.length === 0) {
    // If no history, all time since creation is spent in current status
    const now = new Date();
    const totalTime = now - new Date(this.createdAt);
    if (durations[this.status] !== undefined) {
      durations[this.status] = totalTime;
    }
    return durations;
  }

  const history = [...this.statusHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let lastTimestamp = new Date(this.createdAt);
  let currentStatus = 'open';

  history.forEach(event => {
    const eventTime = new Date(event.timestamp);
    const diff = eventTime - lastTimestamp;
    
    if (durations[currentStatus] !== undefined) {
      durations[currentStatus] += diff;
    }
    
    currentStatus = event.to;
    lastTimestamp = eventTime;
  });

  // Add the time spent in the current status up to now
  const now = new Date();
  const finalDiff = now - lastTimestamp;
  if (durations[currentStatus] !== undefined) {
    durations[currentStatus] += finalDiff;
  }

  return durations;
});

// Indexes
ticketSchema.index({ createdBy: 1, status: 1 });
ticketSchema.index({ assignedTo: 1, status: 1 });
ticketSchema.index({ priority: 1, priorityScore: -1 });
ticketSchema.index({ status: 1, category: 1 });
ticketSchema.index({ 'sla.deadline': 1 });
ticketSchema.index({ ticketId: 1 });
ticketSchema.index({ 'emailSource.messageId': 1 }, { sparse: true });
ticketSchema.index({ title: 'text', description: 'text', tags: 'text' });

ticketSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Ticket', ticketSchema);
