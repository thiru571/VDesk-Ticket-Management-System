const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const mongoose = require('mongoose');

// @desc    Get agent resolution performance metrics
// @route   GET /api/analytics/agent-performance
// @access  Private (Admin)
const getAgentPerformance = async (req, res, next) => {
  try {
    const performanceData = await Ticket.aggregate([
      {
        $match: {
          status: { $in: ['resolved', 'closed'] },
          assignedTo: { $exists: true, $ne: null },
          assignedAt: { $exists: true, $ne: null },
          'resolution.resolvedAt': { $exists: true, $ne: null }
        }
      },
      {
        $project: {
          ticketId: 1,
          title: 1,
          assignedTo: 1,
          priority: 1,
          assignedAt: 1,
          resolvedAt: '$resolution.resolvedAt',
          resolutionTimeMs: {
            $subtract: ['$resolution.resolvedAt', '$assignedAt']
          }
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          totalResolved: { $sum: 1 },
          avgResolutionTimeMs: { $avg: '$resolutionTimeMs' },
          tickets: {
            $push: {
              ticketId: '$ticketId',
              title: '$title',
              priority: '$priority',
              resolutionTimeMs: '$resolutionTimeMs',
              assignedAt: '$assignedAt',
              resolvedAt: '$resolvedAt'
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'agent'
        }
      },
      {
        $unwind: '$agent'
      },
      {
        $project: {
          _id: 1,
          agentName: '$agent.name',
          agentEmail: '$agent.email',
          totalResolved: 1,
          avgResolutionTimeMs: 1,
          tickets: 1
        }
      },
      {
        $sort: { avgResolutionTimeMs: 1 }
      }
    ]);

    res.json({
      success: true,
      data: performanceData
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAgentPerformance
};
