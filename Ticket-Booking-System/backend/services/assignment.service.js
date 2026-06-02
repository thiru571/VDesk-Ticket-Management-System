const User = require('../models/User.model');

/**
 * Auto-assign ticket to the most suitable agent
 * Strategy: Round-robin based on lastAssignedAt timestamp
 */
const autoAssignTicket = async (ticket) => {
  try {
    // We want to sort by lastAssignedAt (ascending), so nulls come first, then oldest dates.
    // In MongoDB, nulls sort first in ascending order, which is perfect for new agents.
    
    // Priority 1: support_agents with matching expertise
    let agents = await User.find({
      role: 'support_agent',
      expertise: ticket.category,
      isActive: true
    }).sort({ lastAssignedAt: 1 });

    // Priority 2: any support_agent in matching department
    if (!agents || agents.length === 0) {
      agents = await User.find({
        role: 'support_agent',
        department: ticket.category,
        isActive: true
      }).sort({ lastAssignedAt: 1 });
    }

    // Priority 3: admin in matching department
    if (!agents || agents.length === 0) {
      agents = await User.find({
        role: 'admin',
        department: ticket.category,
        isActive: true
      }).sort({ lastAssignedAt: 1 });
    }

    // Priority 4: any support_agent
    if (!agents || agents.length === 0) {
      agents = await User.find({
        role: 'support_agent',
        isActive: true
      }).sort({ lastAssignedAt: 1 });
    }

    if (!agents || agents.length === 0) return null;

    // Pick the first one (the one with oldest lastAssignedAt or null)
    const selectedAgent = agents[0];

    // Update their lastAssignedAt timestamp
    await User.findByIdAndUpdate(selectedAgent._id, { lastAssignedAt: new Date() });

    return selectedAgent;
  } catch (err) {
    console.error('Auto-assign error:', err.message);
    return null;
  }
};

/**
 * Increment agent workload
 */
const incrementWorkload = async (agentId) => {
  await User.findByIdAndUpdate(agentId, { $inc: { currentWorkload: 1 } });
};

/**
 * Decrement agent workload (when ticket resolved/closed)
 */
const decrementWorkload = async (agentId) => {
  // Never go below 0
  await User.findByIdAndUpdate(agentId, [{ $set: { currentWorkload: { $max: [0, { $subtract: ['$currentWorkload', 1] }] } } }]);
};

module.exports = { autoAssignTicket, incrementWorkload, decrementWorkload };
