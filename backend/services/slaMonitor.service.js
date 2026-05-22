const Ticket = require('../models/Ticket.model');
const { notifySLAWarning } = require('./notification.service');
const { recalculateTicketScore, calculateSLARisk } = require('./priority.service');
const User = require('../models/User.model');

/**
 * Check all active tickets for SLA warnings and breaches
 * Runs every 15 minutes
 */
const checkSLAStatus = async () => {
  try {
    const now = new Date();
    
    // Update SLA Risk for ALL active tickets first
    const activeTickets = await Ticket.find({ status: { $nin: ['resolved', 'closed'] } });
    for (const ticket of activeTickets) {
      const currentRisk = calculateSLARisk(ticket.sla?.deadline);
      if (ticket.sla && ticket.sla.risk !== currentRisk) {
        ticket.sla.risk = currentRisk;
        await ticket.save();
      }
    }

    const warningThreshold = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour warning

    // Find tickets approaching SLA breach
    const warningTickets = await Ticket.find({
      status: { $nin: ['resolved', 'closed'] },
      'sla.deadline': { $lte: warningThreshold, $gt: now },
      'sla.breached': false
    }).populate('createdBy assignedTo', 'name email notificationPreferences');

    for (const ticket of warningTickets) {
      await notifySLAWarning(ticket);
    }

    // Mark breached tickets
    const breachedTickets = await Ticket.find({
      status: { $nin: ['resolved', 'closed'] },
      'sla.deadline': { $lte: now },
      'sla.breached': false
    });

    for (const ticket of breachedTickets) {
      ticket.sla.breached = true;
      ticket.sla.breachedAt = now;

      // Escalate priority if not already critical
      if (ticket.priority !== 'critical') {
        ticket.priorityAudit.push({
          from: ticket.priority,
          to: 'critical',
          previousScore: ticket.priorityScore,
          newScore: ticket.priorityScore + 20,
          reason: 'auto-escalation: SLA breached',
          changedBy: null
        });
        ticket.priority = 'critical';
        ticket.priorityScore = Math.min(ticket.priorityScore + 20, 100);
      }

      await ticket.save();
      console.log(`🚨 SLA Breached: ${ticket.ticketId}`);
    }

    // Recalculate scores for aging tickets (queue bonus increases with age)
    const agingTickets = await Ticket.find({
      status: { $in: ['open', 'assigned'] },
      createdAt: { $lte: new Date(now - 24 * 60 * 60 * 1000) } // older than 24h
    }).populate('createdBy', 'role');

    for (const ticket of agingTickets) {
      const user = ticket.createdBy;
      const result = await recalculateTicketScore(ticket, user);

      if (Math.abs(result.finalScore - ticket.priorityScore) > 5) {
        ticket.priorityAudit.push({
          from: ticket.priority,
          to: result.priority,
          previousScore: ticket.priorityScore,
          newScore: result.finalScore,
          reason: 'auto-rule: age-bonus recalculation'
        });
        ticket.priorityScore = result.finalScore;
        ticket.priority = result.priority;
        ticket.scoreBreakdown = result.breakdown;
        await ticket.save();
      }
    }

    if (warningTickets.length > 0 || breachedTickets.length > 0) {
      console.log(`⏰ SLA Check: ${warningTickets.length} warnings, ${breachedTickets.length} breaches`);
    }

    // Always broadcast updates for scores (since time increases)
    await broadcastSLAUpdates();
  } catch (err) {
    console.error('SLA check error:', err.message);
  }
};

let slaInterval = null;

const startSLAMonitor = () => {
  if (slaInterval) return;
  checkSLAStatus(); // Run immediately
  slaInterval = setInterval(checkSLAStatus, 15 * 60 * 1000); // Every 15 min
  console.log('⏰ SLA monitor started');
};

const broadcastSLAUpdates = async () => {
  try {
    const { getIO } = require('../config/socket');
    const io = getIO();
    if (io) {
      const activeTickets = await Ticket.find({ status: { $nin: ['resolved', 'closed'] } });
      io.emit('sla:update', { 
        tickets: activeTickets.map(t => ({ 
          id: t._id, 
          slaScore: t.slaScore, 
          slaStatus: t.slaStatus, 
          slaRisk: t.sla?.risk 
        })) 
      });
    }
  } catch (err) {
    console.error('SLA broadcast error:', err.message);
  }
};

const stopSLAMonitor = () => {
  if (slaInterval) {
    clearInterval(slaInterval);
    slaInterval = null;
  }
};

module.exports = { startSLAMonitor, stopSLAMonitor, checkSLAStatus };
