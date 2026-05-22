const User = require('../models/User.model');
const Ticket = require('../models/Ticket.model');
const Department = require('../models/Department');

// Helper to get date range
const getDateRange = (period) => {
  const now = new Date();
  let startDate;
  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case 'month':
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    case 'overall':
    default:
      startDate = new Date(0); // Epoch start
      break;
  }
  return { $gte: startDate, $lte: new Date() };
};

// @desc    Get agent performance metrics for a department
// @route   GET /api/admin/performance
// @access  Private (department_admin)
exports.getAgentPerformance = async (req, res, next) => {
  try {
    const { period = 'overall' } = req.query;
    const dateRange = getDateRange(period);

    // Department admin can only see agents in their department
    const departmentId = req.user.department?._id || req.user.department;

    const agents = await User.find({
      department: departmentId,
      role: 'support_agent',
      isActive: true
    }).select('_id name email role shift');

    const performanceData = [];

    for (const agent of agents) {
      const assignedTickets = await Ticket.countDocuments({
        assignedTo: agent._id,
        createdAt: dateRange
      });

      const resolvedTickets = await Ticket.countDocuments({
        assignedTo: agent._id,
        status: 'resolved',
        'resolution.resolvedAt': dateRange
      });

      const openTickets = await Ticket.countDocuments({
        assignedTo: agent._id,
        status: 'open'
      });

      const inProgressTickets = await Ticket.countDocuments({
        assignedTo: agent._id,
        status: 'in_progress'
      });

      const onHoldTickets = await Ticket.countDocuments({
        assignedTo: agent._id,
        status: 'on_hold'
      });

      // Calculate average resolution time
      const resolvedTicketsForAvg = await Ticket.find({
        assignedTo: agent._id,
        status: 'resolved',
        'resolution.resolvedAt': dateRange
      }).select('createdAt resolution.resolvedAt');

      let totalResolutionTime = 0;
      resolvedTicketsForAvg.forEach(ticket => {
        if (ticket.createdAt && ticket.resolution?.resolvedAt) {
          totalResolutionTime += (ticket.resolution.resolvedAt.getTime() - ticket.createdAt.getTime());
        }
      });
      const avgResolutionTime = resolvedTickets > 0 ? (totalResolutionTime / resolvedTickets / (1000 * 60 * 60)) : 0; // in hours

      performanceData.push({
        agentId: agent._id,
        agentName: agent.name,
        agentEmail: agent.email,
        agentRole: agent.agentRole,
        shift: agent.shift,
        assigned: assignedTickets,
        resolved: resolvedTickets,
        open: openTickets,
        inProgress: inProgressTickets,
        onHold: onHoldTickets,
        avgResolutionTime: parseFloat(avgResolutionTime.toFixed(2))
      });
    }

    res.json({ success: true, data: performanceData });
  } catch (err) {
    next(err);
  }
};

// @desc    Get pending hold requests for a department
// @route   GET /api/admin/hold-requests
// @access  Private (department_admin)
exports.getPendingHoldRequests = async (req, res, next) => {
  try {
    const departmentId = req.user.department?._id || req.user.department;

    const pendingHolds = await Ticket.find({
      assignedDepartment: departmentId,
      'holdRequest.status': 'pending'
    })
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .select('ticketId title holdRequest.reason holdRequest.requestedBy holdRequest.requestedAt assignedTo createdBy')
      .lean();

    res.json({ success: true, data: pendingHolds });
  } catch (err) {
    next(err);
  }
};

// @desc    Get super admin dashboard stats
// @route   GET /api/super-admin/stats
// @access  Private (super_admin)
exports.getSuperAdminStats = async (req, res, next) => {
  try {
    // Departments stats
    const totalDepartments = await Department.countDocuments();
    const activeDepartments = await Department.countDocuments({ isActive: true });
    const inactiveDepartments = totalDepartments - activeDepartments;

    // Users stats
    const totalDeptAdmins = await User.countDocuments({ role: 'department_admin' });
    const totalAgents = await User.countDocuments({ role: 'agent' });
    const totalEmployees = await User.countDocuments({ userType: 'employee' });

    const departmentsWithStaff = await Department.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'department',
          as: 'staff'
        }
      },
      {
        $project: {
          name: 1,
          adminCount: { $size: { $filter: { input: '$staff', as: 's', cond: { $eq: ['$$s.role', 'department_admin'] } } } },
          agentCount: { $size: { $filter: { input: '$staff', as: 's', cond: { $eq: ['$$s.role', 'agent'] } } } }
        }
      }
    ]);

    // Tickets stats
    const totalTickets = await Ticket.countDocuments();
    const ticketsByStatus = await Ticket.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusCounts = ticketsByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const ticketsByShift = await Ticket.aggregate([
      { $group: { _id: '$shift', count: { $sum: 1 } } }
    ]);
    const shiftCounts = ticketsByShift.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { Morning: 0, Mid: 0, Night: 0 });

    const ticketsByDepartment = await Ticket.aggregate([
      { $lookup: { from: 'departments', localField: 'assignedDepartment', foreignField: '_id', as: 'departmentInfo' } },
      { $unwind: '$departmentInfo' },
      { $group: { _id: '$departmentInfo.name', count: { $sum: 1 } } },
      { $project: { deptName: '$_id', count: 1, _id: 0 } }
    ]);

    const ticketsBySource = await Ticket.aggregate([
      { $group: { _id: '$ticketSource', count: { $sum: 1 } } }
    ]);
    const sourceCounts = ticketsBySource.reduce((acc, item) => {
      acc[item._id.replace(/\s/g, '')] = item.count; // Remove spaces for cleaner keys
      return acc;
    }, { HelpDesk: 0, MailTicket: 0, Digital: 0, OnboardOffboarding: 0 });

    res.json({
      success: true,
      data: {
        departments: {
          total: totalDepartments,
          active: activeDepartments,
          inactive: inactiveDepartments
        },
        users: {
          totalDeptAdmins,
          totalAgents,
          totalEmployees,
          perDepartment: departmentsWithStaff.map(d => ({ deptName: d.name, adminCount: d.adminCount, agentCount: d.agentCount }))
        },
        tickets: {
          total: totalTickets,
          byStatus: statusCounts,
          byShift: shiftCounts,
          byDepartment: ticketsByDepartment,
          bySource: sourceCounts
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get reports by shift and view (daily/weekly)
// @route   GET /api/admin/reports
// @access  Private (department_admin, super_admin)
exports.getReports = async (req, res, next) => {
  try {
    const { shift = 'All', view = 'daily' } = req.query;
    const dateRange = getDateRange(view);

    const query = { createdAt: dateRange };

    if (shift !== 'All') {
      query.shift = shift;
    }

    // Filter by department for department_admin
    if (req.user.role === 'department_admin') {
      query.assignedDepartment = req.user.department?._id || req.user.department;
    }

    const totalTickets = await Ticket.countDocuments(query);
    const ticketsByStatus = await Ticket.aggregate([
      { $match: query },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusCounts = ticketsByStatus.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, { open: 0, in_progress: 0, on_hold: 0, resolved: 0, closed: 0, pending_confirmation: 0 });

    const tickets = await Ticket.find(query)
      .populate('assignedTo', 'name email')
      .select('ticketId title category status shift assignedTo createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: {
        shift,
        view,
        totalTickets,
        byStatus: statusCounts,
        tickets
      }
      
    });
    console.log('Report generated successfully');
  } catch (err) {
    next(err);
  }
};