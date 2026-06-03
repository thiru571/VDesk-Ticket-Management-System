const Ticket = require('../models/Ticket.model');
const User = require('../models/User.model');
const Comment = require('../models/Comment.model');
const Department = require('../models/Department');
const {
  calculatePriorityScore,
  calculateSLADeadline,
  calculateResponseDeadline,
  suggestPriorityFromText,
  recalculateTicketScore
} = require('../services/priority.service');
const { autoAssignTicket, incrementWorkload, decrementWorkload } = require('../services/assignment.service');
const { notifyTicketAssigned, notifyStatusChange, createNotification } = require('../services/notification.service');
const { sendTicketConfirmation, sendStatusUpdate, sendStatusChangeEmail, sendResolveEmail, sendAckEmail } = require('../services/email.service');
const { sendInAppMessage } = require('../services/message.service'); // Assuming a message service for in-app messages
const { emitToUser, emitToRole, emitToTicket } = require('../config/socket');
const { getSystemStatusAverages } = require('../services/analytics.service');

// @desc    Create ticket
// @route   POST /api/tickets
// @access  Private
const createTicket = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      impactScope,
      urgencyLevel,
      preferredContact,
      context,
      relatedTickets,
      manualPriority,
      issueStarted,
      tags,
      location,
      shift,
      ticketType,
      source,
      mobileNumber,
      assetId,
      subCategory
    } = req.body;
    console.log('Creating ticket with data:', req.body);

    // Feature 19: Asset ID mandatory for specific categories
    const itCategories = ['Hardware Issue', 'IT Request', 'Replacement'];

    if (itCategories.includes(category) && !assetId) {
      return res.status(400).json({
        success: false,
        message: 'Asset ID is required for this category.'
      });
    }

    // Office to VP Mapping
    const vpMapping = {
      GICC: 'VP-GICC',
      Bangalore: 'VP-Bangalore',
      Remote: null,
      Other: null
    };

    const vpAssigned = vpMapping[location] || null;

    // Duplicate detection
    const duplicateCheck = await Ticket.findOne({
      createdBy: req.user._id,
      status: { $nin: ['resolved', 'closed'] },
      $text: { $search: title }
    }).select('ticketId title status');

    // Attachments
    const attachments = (req.files || []).map((f) => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      path: f.path,
      uploadedBy: req.user._id
    }));

    // Calculate priority
    const scoring = calculatePriorityScore({
      impactScope: impactScope || 'just_me',
      urgencyLevel: urgencyLevel || 'flexible',
      role: req.user.role,
      title,
      description,
      createdAt: new Date()
    });

    const finalPriority =
      manualPriority &&
      ['admin', 'support_agent'].includes(req.user.role)
        ? manualPriority
        : scoring.priority;

    const prioritySource =
      manualPriority &&
      ['admin', 'support_agent'].includes(req.user.role)
        ? 'manual'
        : 'auto';

    const slaDeadline = await calculateSLADeadline(finalPriority);

    const responseDeadline =
      await calculateResponseDeadline(finalPriority);

    // Create Ticket
    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      category,
      ticketType,
      source: source || 'Portal',
      officeLocation: location || undefined,
      shift: shift || 'Morning',
      assetId,
      ticketSource:
        source === 'Help Desk'
          ? 'Help Desk'
          : 'Digital',
      vpAssigned,
      mobileNumber,
      priority: finalPriority,
      priorityScore: scoring.finalScore,
      prioritySource,
      scoreBreakdown: scoring.breakdown,
      impactScope: impactScope || 'just_me',
      urgencyLevel: urgencyLevel || 'flexible',
      createdBy: req.user._id,
      preferredContact:
        preferredContact || req.user.preferredContact,
      context: {
        ...context,
        issueStarted
      },
      relatedTickets: relatedTickets || [],
      attachments,
      tags: tags || [],
      sla: {
        deadline: slaDeadline,
        responseDeadline
      },
      subCategory: subCategory || undefined,

      // Default Status
      status: 'open'
    });

    // Department Routing
    let assignedDepartment = null;
    let departmentAdminId = null;

    const routingMap = {
      'Network Issue': 'IT Department',
      'Software Issue': 'IT Department',
      'Hardware Issue': 'IT Department',
      'IT Request': 'IT Department',
      Replacement: 'IT Department',
      'Email Login Issue': 'IT Department',
      Other: 'IT Department'
    };

    let targetDeptName =
      routingMap[category] || 'IT Department';

    if (category === 'HR Needs') {
      const hrDept = await Department.findOne({
        name: 'HR Department'
      });

      if (hrDept && hrDept.isActive) {
        targetDeptName = 'HR Department';
      } else {
        targetDeptName = 'IT Department';
      }
    }

    const dept = await Department.findOne({
      name: targetDeptName
    }).lean();

    if (dept) {
      assignedDepartment = dept._id;
      departmentAdminId = dept.adminId;

      ticket.assignedDepartment = assignedDepartment;
    }

    // Auto Assign Ticket
    const agent = await autoAssignTicket(ticket);

    if (agent) {
      ticket.assignedTo = agent._id;
      ticket.assignedAt = new Date();
      ticket.assignedBy = null; // system
      ticket.autoAssigned = true;

      // Employee sees Pending
      ticket.status = 'open';

      ticket.statusHistory.push({
        from: 'open',
        to: 'pending',
        reason:
          'Ticket assigned and waiting for agent action'
      });

      await ticket.save();

      // Increase workload
      await incrementWorkload(agent._id);

      // Notify assigned agent
      await notifyTicketAssigned(
        ticket,
        agent,
        req.user
      );

    } else if (departmentAdminId) {

      // Fallback to department admin
      ticket.assignedTo = departmentAdminId;

      await ticket.save();
    }

    // Update user stats
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: {
          'stats.totalRaised': 1
        }
      }
    );

    // Send confirmation email
    sendTicketConfirmation({
      to: req.user.email,
      name: req.user.name,
      ticket
    }).catch(() => {});

    // Populate user + assigned agent
    await ticket.populate(
      'createdBy assignedTo',
      'name email department avatar'
    );

    // Socket realtime notification
    const socketPayload = {
      ticketId: ticket._id,
      ticket,
      title: ticket.title,
      priority: ticket.priority
    };

    emitToRole(
      'admin',
      'ticket_created',
      socketPayload
    );

    emitToRole(
      'support_agent',
      'ticket_created',
      socketPayload
    );

    // Response
    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket,
      duplicate: duplicateCheck
        ? {
            found: true,
            ticket: duplicateCheck
          }
        : {
            found: false
          }
    });

  } catch (err) {
    next(err);
  }
};

// @desc    Get tickets (with filtering, sorting, pagination)
// @route   GET /api/tickets
// @access  Private
const getTickets = async (req, res, next) => {
  try {
    const {
      status, priority, category, search,
      sortBy = 'priorityScore', sortOrder = 'desc',
      page = 1, limit = 20,
      assignedTo, createdBy, slaBreached,
      dateFrom, dateTo, myTickets
    } = req.query;

    const mongoose = require('mongoose');
    const query = {};
    const userDept = req.user.department;
    const isDeptId = mongoose.Types.ObjectId.isValid(userDept);

    // Role-based filtering
    if (req.user.role === 'employee') {
      query.createdBy = req.user._id;
    } else if (req.user.role === 'support_agent') {
      if (myTickets === 'true') {
        query.assignedTo = req.user._id;
      } else {
        // Show my assignments OR unassigned items in my department
        const deptFilter = [{ category: userDept }];
        if (isDeptId) deptFilter.push({ assignedDepartment: userDept });
        
        // Broaden IT/HR filters for both string and ID based departments
        const IT_DEPT_ID = '69eee5d5264825d7c4a33478';
        const HR_DEPT_ID = '69eee5d5264825d7c4a3347b';
        const IT_CATEGORIES = ['IT', 'Network', 'Software', 'Hardware', 'Request', 'Replacement', 'Network Issue', 'Software Issue', 'Hardware Issue', 'IT Request', 'Email Login Issue'];
        const HR_CATEGORIES = ['HR', 'HR Needs', 'Payroll', 'Leave Request', 'Benefits', 'Policy Query', 'Recruitment', 'Onboarding', 'Offboarding'];

        if (userDept === 'IT' || userDept === IT_DEPT_ID) {
          deptFilter.push({ category: { $in: IT_CATEGORIES } });
        }
        if (userDept === 'HR' || userDept === HR_DEPT_ID) {
          deptFilter.push({ category: { $in: HR_CATEGORIES } });
        }
        
        query.$or = [
          { assignedTo: req.user._id },
          { assignedTo: null, $or: deptFilter }
        ];
      }
    } else if (req.user.role === 'admin') {
      if (myTickets === 'true') {
        query.assignedTo = req.user._id;
      } else if (userDept && userDept.toString() !== 'Admin') {
        // Department Admin: Show my assignments OR all items in my department
        const deptFilter = [{ category: userDept }];
        if (isDeptId) deptFilter.push({ assignedDepartment: userDept });
        
        // Broaden IT/HR filters for both string and ID based departments
        const IT_DEPT_ID = '69eee5d5264825d7c4a33478';
        const HR_DEPT_ID = '69eee5d5264825d7c4a3347b';
        const IT_CATEGORIES = ['IT', 'Network', 'Software', 'Hardware', 'Request', 'Replacement', 'Network Issue', 'Software Issue', 'Hardware Issue', 'IT Request', 'Email Login Issue'];
        const HR_CATEGORIES = ['HR', 'HR Needs', 'Payroll', 'Leave Request', 'Benefits', 'Policy Query', 'Recruitment', 'Onboarding', 'Offboarding'];

        if (userDept === 'IT' || userDept === IT_DEPT_ID) {
          deptFilter.push({ category: { $in: IT_CATEGORIES } });
        }
        if (userDept === 'HR' || userDept === HR_DEPT_ID) {
          deptFilter.push({ category: { $in: HR_CATEGORIES } });
        }
        
        query.$or = [
          { assignedTo: req.user._id },
          { $or: deptFilter }
        ];
      }
      // If department === 'Admin', no department filter is applied (sees all)
    }

    // Filters - Ignore "All" or empty strings
    if (status && status !== 'All' && status !== '') query.status = { $in: status.split(',') };
    if (priority && priority !== 'All' && priority !== '') query.priority = { $in: priority.split(',') };
    if (category && category !== 'All' && category !== '') query.category = { $in: category.split(',') };
    if (assignedTo && assignedTo !== 'All' && assignedTo !== '') query.assignedTo = assignedTo;
    if (createdBy && createdBy !== 'All' && createdBy !== '' && req.user.role !== 'employee') query.createdBy = createdBy;
    if (slaBreached === 'true') query['sla.breached'] = true;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    // Text search
    if (search && search.trim() !== '') {
      query.$text = { $search: search };
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    // Secondary sort for stable ordering
    sort.createdAt = -1;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort,
      populate: [
        { path: 'createdBy', select: 'name email department avatar' },
        { path: 'assignedTo', select: 'name email department avatar' }
      ],
      lean: true
    };

    const result = await Ticket.paginate(query, options);

    // Fetch system averages
    const systemAverages = await getSystemStatusAverages();

    // Manually add durations since we use lean: true
    const ticketsWithDurations = result.docs.map(ticket => {
      const durations = { open: 0, assigned: 0, in_progress: 0, closed: 0 };
      const history = [...(ticket.statusHistory || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      let lastTimestamp = new Date(ticket.createdAt);
      let currentStatus = 'open';

      history.forEach(event => {
        const eventTime = new Date(event.timestamp);
        const diff = eventTime - lastTimestamp;
        if (durations[currentStatus] !== undefined) durations[currentStatus] += diff;
        currentStatus = event.to;
        lastTimestamp = eventTime;
      });

      const now = new Date();
      const finalDiff = now - lastTimestamp;
      if (durations[currentStatus] !== undefined) durations[currentStatus] += finalDiff;
      
      return { ...ticket, durations };
    });

    res.json({
      success: true,
      tickets: ticketsWithDurations,
      systemAverages,
      pagination: {
        total: result.totalDocs,
        pages: result.totalPages,
        page: result.page,
        limit: result.limit,
        hasNext: result.hasNextPage,
        hasPrev: result.hasPrevPage
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single ticket
// @route   GET /api/tickets/:id
// @access  Private
const getTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('createdBy', 'name email department designation avatar location preferredContact')
      .populate('assignedTo', 'name email department designation avatar')
      .populate('assignedBy', 'name email')
      .populate('relatedTickets', 'ticketId title status priority')
      .populate('duplicateOf', 'ticketId title status')
      .populate('statusHistory.changedBy', 'name email')
      .populate('priorityAudit.changedBy', 'name email')
      .lean();

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Access control: employees only see their own tickets
    if (req.user.role === 'employee' && ticket.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // Increment view count (Non-blocking for faster response)
    Ticket.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).exec().catch(err => console.error('View count update failed:', err.message));

    // Fetch system averages
    const systemAverages = await getSystemStatusAverages();

    // Calculate durations manually for lean object
    const durations = { open: 0, assigned: 0, in_progress: 0, closed: 0 };
    const history = [...(ticket.statusHistory || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    let lastTimestamp = new Date(ticket.createdAt);
    let currentStatus = 'open';

    history.forEach(event => {
      const eventTime = new Date(event.timestamp);
      const diff = eventTime - lastTimestamp;
      if (durations[currentStatus] !== undefined) durations[currentStatus] += diff;
      currentStatus = event.to;
      lastTimestamp = eventTime;
    });

    const now = new Date();
    const finalDiff = now - lastTimestamp;
    if (durations[currentStatus] !== undefined) durations[currentStatus] += finalDiff;

    res.json({ success: true, ticket: { ...ticket, durations }, systemAverages });
  } catch (err) {
    next(err);
  }
};

// @desc    Update ticket status
// @route   PATCH /api/tickets/:id/status
// @access  Private (agent/admin)
const updateStatus = async (req, res, next) => {
  try {
    const { status, reason, estimatedResolutionTime, resolution } = req.body;
    const validStatuses = ['open', 'assigned', 'in_progress', 'reopened', 'on_hold', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Feature 20: Admin Locking on Hold
    if (ticket.status === 'on_hold') {
      if (!ticket.lockedToAdmin ||
        ticket.lockedToAdmin.toString() !== req.user._id.toString()) {
        // Only the admin who approved the hold can change its status.
        return res.status(403).json({ success: false, message: 'This ticket is on hold and locked. Only the admin who approved the hold can change its status.' });
      }
    }

    // Only assigned agent or admin can change status
    if (req.user.role === 'support_agent' && ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can update this ticket' });
    }

    // Strict Hold Workflow: Only admins can update status once On Hold
    if (ticket.status === 'on_hold' && !['admin', 'super_admin', 'department_admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'This ticket is on hold. Only authorized administrators can update its status.' });
    }

    const oldStatus = ticket.status;
    ticket.status = status;
    ticket.statusHistory.push({
      from: oldStatus,
      to: status,
      changedBy: req.user._id,
      reason: reason || ''
    });

    if (estimatedResolutionTime) ticket.estimatedResolutionTime = new Date(estimatedResolutionTime);

    if (status === 'resolved') {
      ticket.sla.resolvedAt = new Date();
      ticket.resolution = { notes: resolution?.notes, resolvedAt: new Date(), resolvedBy: req.user._id };
      if (ticket.assignedTo) await decrementWorkload(ticket.assignedTo);
      await User.findByIdAndUpdate(req.user._id, { $inc: { 'stats.totalResolved': 1 } });
    }

    if (status === 'in_progress') {
      ticket.sla.respondedAt = new Date();
    }

    // AUTO-ACK: Send acknowledgment email when first status change occurs
    if (['in_progress', 'assigned'].includes(status) && !ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
      // Ensure createdBy is populated for email
      const populated = await Ticket.findById(ticket._id).populate('createdBy', 'name email');
      if (populated.createdBy?.email) {
        sendAckEmail({ to: populated.createdBy.email, name: populated.createdBy.name, ticket: populated }).catch(() => { });
      }
    }

    await ticket.save();
    await ticket.populate('createdBy assignedTo', 'name email notificationPreferences');

    // Notify affected users
    const affectedUsers = [
      ticket.createdBy?._id || ticket.createdBy,
      ticket.assignedTo?._id || ticket.assignedTo
    ].filter(Boolean);

    await notifyStatusChange(ticket, status, req.user, affectedUsers);

    // Email worker on every status change (only if email is available)
    if (ticket.createdBy?.email) {
      sendStatusChangeEmail({
        to: ticket.createdBy.email,
        name: ticket.createdBy.name || 'User',
        ticket,
        newStatus: status
      }).catch(() => { });
    }

    // Real-time
    emitToTicket(ticket._id.toString(), 'status_updated', {
      ticketId: ticket._id,
      status: status,
      changedBy: { name: req.user.name },
      timestamp: new Date(),
      firstResponseAt: ticket.firstResponseAt
    });

    // Broadcast to role rooms so list pages update in real-time
    const statusPayload = { ticketId: ticket._id, status: status, changedBy: { name: req.user.name } };
    emitToRole('admin', 'ticket_status_changed', statusPayload);
    emitToRole('support_agent', 'ticket_status_changed', statusPayload);
    // Also notify the ticket creator
    if (ticket.createdBy?._id) emitToUser(ticket.createdBy._id.toString(), 'ticket_status_changed', statusPayload);

    res.json({ success: true, message: 'Status updated', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Assign ticket
// @route   PATCH /api/tickets/:id/assign
// @access  Private (admin/agent)
const assignTicket = async (req, res, next) => {
  try {
    const { agentId } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const agent = await User.findOne({ _id: agentId, role: { $in: ['support_agent', 'admin'] } });
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    // Decrement old agent workload
    if (ticket.assignedTo) await decrementWorkload(ticket.assignedTo);

    ticket.assignedTo = agentId;
    ticket.assignedAt = new Date();
    ticket.assignedBy = req.user._id;
    ticket.autoAssigned = false;
    if (ticket.status === 'open') {
      ticket.status = 'assigned';
      ticket.statusHistory.push({ from: 'open', to: 'assigned', changedBy: req.user._id, reason: 'Manual assignment' });
    }

    // AUTO-ACK: Send acknowledgment email when manually assigned
    if (!ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();
      const populated = await Ticket.findById(ticket._id).populate('createdBy', 'name email');
      if (populated.createdBy?.email) {
        sendAckEmail({ to: populated.createdBy.email, name: populated.createdBy.name, ticket: populated }).catch(() => { });
      }
    }
    await ticket.save();
    await incrementWorkload(agentId);
    await notifyTicketAssigned(ticket, agent, req.user);

    emitToTicket(ticket._id.toString(), 'ticket_assigned', {
      ticketId: ticket._id,
      assignedTo: { _id: agent._id, name: agent.name },
      firstResponseAt: ticket.firstResponseAt
    });

    // Broadcast to role rooms so list pages update in real-time
    const assignPayload = { ticketId: ticket._id, assignedTo: { _id: agent._id, name: agent.name }, status: ticket.status };
    emitToRole('admin', 'ticket_assignment_changed', assignPayload);
    emitToRole('support_agent', 'ticket_assignment_changed', assignPayload);

    res.json({ success: true, message: 'Ticket assigned', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Reopen ticket
// @route   PATCH /api/tickets/:id/reopen
// @access  Private (creator)
const reopenTicket = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason is required to reopen' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (!['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Only resolved or closed tickets can be reopened' });
    }

    if (req.user.role === 'employee' && ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    ticket.status = 'reopened';
    ticket.reopenCount += 1;
    ticket.reopenReason = reason;
    ticket.lastReopenedAt = new Date();
    ticket.statusHistory.push({ from: 'resolved', to: 'reopened', changedBy: req.user._id, reason });

    // Reset SLA
    const slaDeadline = await calculateSLADeadline(ticket.priority);
    ticket.sla.deadline = slaDeadline;
    ticket.sla.breached = false;
    ticket.sla.breachedAt = undefined;

    await ticket.save();

    // Notify assigned agent
    if (ticket.assignedTo) {
      await createNotification({
        recipientId: ticket.assignedTo,
        type: 'ticket_reopened',
        title: 'Ticket Reopened',
        message: `Ticket ${ticket.ticketId} has been reopened. Reason: ${reason}`,
        ticketId: ticket._id,
        triggeredById: req.user._id,
        link: `/tickets/${ticket._id}`
      });
    }

    // Send email to creator about reopening
    await ticket.populate('createdBy', 'name email');
    sendStatusChangeEmail({ to: ticket.createdBy.email, name: ticket.createdBy.name, ticket, newStatus: 'reopened' }).catch(() => { });

    emitToTicket(ticket._id.toString(), 'ticket_reopened', { ticketId: ticket._id, reason });

    // Broadcast to role rooms so list pages update in real-time
    const statusPayload = { ticketId: ticket._id, status: 'reopened', changedBy: { name: req.user.name } };
    emitToRole('admin', 'ticket_status_changed', statusPayload);
    emitToRole('support_agent', 'ticket_status_changed', statusPayload);

    res.json({ success: true, message: 'Ticket reopened', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Submit feedback/rating
// @route   POST /api/tickets/:id/feedback
// @access  Private (creator only)
const submitFeedback = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the ticket creator can submit feedback' });
    }

    if (!['resolved', 'closed'].includes(ticket.status)) {
      return res.status(400).json({ success: false, message: 'Can only rate resolved tickets' });
    }

    ticket.feedback = { rating, comment, submittedAt: new Date() };
    ticket.status = 'closed';
    ticket.statusHistory.push({ from: ticket.status, to: 'closed', changedBy: req.user._id, reason: 'Closed after feedback' });
    await ticket.save();

    // Broadcast status change to 'closed'
    const statusPayload = { ticketId: ticket._id, status: 'closed', changedBy: { name: req.user.name } };
    emitToRole('admin', 'ticket_status_changed', statusPayload);
    emitToRole('support_agent', 'ticket_status_changed', statusPayload);
    emitToTicket(ticket._id.toString(), 'status_updated', statusPayload);

    res.json({ success: true, message: 'Feedback submitted. Thank you!', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Get priority suggestion
// @route   POST /api/tickets/suggest-priority
// @access  Private
const suggestPriority = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const suggestion = suggestPriorityFromText(title, description);
    res.json({ success: true, ...suggestion });
  } catch (err) {
    next(err);
  }
};

// @desc    Search similar tickets (duplicate detection)
// @route   GET /api/tickets/similar
// @access  Private
const findSimilarTickets = async (req, res, next) => {
  try {
    const { title, category } = req.query;
    if (!title) return res.json({ success: true, tickets: [] });

    const tickets = await Ticket.find({
      $text: { $search: title },
      category,
      status: { $nin: ['closed'] }
    })
      .select('ticketId title status priority createdAt')
      .limit(5)
      .lean();

    res.json({ success: true, tickets });
  } catch (err) {
    next(err);
  }
};

// @desc    Update priority manually (admin/agent)
// @route   PATCH /api/tickets/:id/priority
// @access  Private (admin/agent)
const updatePriority = async (req, res, next) => {
  try {
    const { priority, reason } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const oldPriority = ticket.priority;
    ticket.priorityAudit.push({
      from: oldPriority,
      to: priority,
      previousScore: ticket.priorityScore,
      newScore: ticket.priorityScore,
      changedBy: req.user._id,
      reason: reason || 'Manual override'
    });

    ticket.priority = priority;
    ticket.prioritySource = 'manual';

    // Recalculate SLA deadline
    const slaDeadline = calculateSLADeadline(priority);
    ticket.sla.deadline = slaDeadline;

    await ticket.save();

    emitToTicket(ticket._id.toString(), 'priority_updated', { ticketId: ticket._id, priority, changedBy: req.user.name });

    // Broadcast to role rooms so list pages update in real-time
    const priorityPayload = { ticketId: ticket._id, priority, changedBy: req.user.name };
    emitToRole('admin', 'ticket_priority_changed', priorityPayload);
    emitToRole('support_agent', 'ticket_priority_changed', priorityPayload);

    res.json({ success: true, message: 'Priority updated', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete ticket (admin only)
// @route   DELETE /api/tickets/:id
// @access  Private (admin)
const deleteTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (ticket.assignedTo) await decrementWorkload(ticket.assignedTo);
    await Comment.deleteMany({ ticket: ticket._id });
    await ticket.deleteOne();
    res.json({ success: true, message: 'Ticket deleted' });
  } catch (err) {
    next(err);
  }
};

// @desc    Update ticket priority and/or status (admin only)
// @route   PATCH /api/tickets/update-ticket/:id
// @access  Private (admin)
const updateTicket = async (req, res, next) => {
  try {
    const { priority, status } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (priority) ticket.priority = priority;

    if (status) {
      const oldStatus = ticket.status;
      ticket.status = status;
      ticket.statusHistory.push({ from: oldStatus, to: status, changedBy: req.user._id });

      if (['resolved', 'closed'].includes(status)) {
        ticket.updatedAt = new Date();
      }
    }

    await ticket.save();

    // Trigger email if status changed
    if (status) {
      await ticket.populate('createdBy', 'name email');
      if (ticket.createdBy?.email) {
        sendStatusChangeEmail({ to: ticket.createdBy.email, name: ticket.createdBy.name, ticket, newStatus: status }).catch(() => { });
      }
    }

    res.json({ success: true, message: 'Ticket updated', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent starts travel/work for on-site visit
// @route   POST /api/tickets/:id/start-onsite
// @access  Private (assigned agent)
const startOnSite = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can start on-site visit' });
    }

    const user = await User.findById(req.user._id);
    // Hard Rule: Only one active on-site allowed
    if (user.liveStatus === 'on_site' && user.onSiteTicket && user.onSiteTicket.toString() !== ticket._id.toString()) {
      // Check if the ticket referenced still exists and is not resolved
      const otherTicket = await Ticket.findById(user.onSiteTicket);
      if (otherTicket && !['resolved', 'closed'].includes(otherTicket.status)) {
        return res.status(400).json({
          success: false,
          message: `You are already on-site for ticket ${otherTicket.ticketId}. Please resolve it before starting another on-site visit.`
        });
      }
    }

    // Update User Status
    user.liveStatus = 'on_site';
    user.onSiteTicket = ticket._id;
    user.lastStatusUpdate = new Date();
    await user.save();

    // Update Ticket
    if (!ticket.onSiteVisit.requestedAt) {
      ticket.onSiteVisit.requestedAt = new Date();
    }

    // Also move status to in_progress if it isn't already
    if (ticket.status === 'assigned' || ticket.status === 'open') {
      const oldStatus = ticket.status;
      ticket.status = 'in_progress';
      ticket.statusHistory.push({ from: oldStatus, to: 'in_progress', changedBy: req.user._id, reason: 'Started on-site visit' });
    }
    await ticket.save();

    // Notify admins for live dashboard
    emitToRole('admin', 'agent_status_updated', {
      agentId: user._id,
      name: user.name,
      status: 'on_site',
      ticketId: ticket.ticketId,
      ticketDbId: ticket._id,
      timestamp: user.lastStatusUpdate
    });

    res.json({ success: true, message: 'On-site visit started. Live timer active on dashboard.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent marks themselves as arrived on-site
// @route   POST /api/tickets/:id/arrive
// @access  Private (assigned agent)
const markArrived = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('createdBy assignedTo');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can mark arrival' });
    }

    ticket.onSiteVisit.arrivedAt = new Date();
    // Start the timer if they forgot to click "Start"
    if (!ticket.onSiteVisit.requestedAt) ticket.onSiteVisit.requestedAt = new Date();

    // Arrival records: Agent is now at target location and available for work/resolutions
    const user = await User.findById(req.user._id);
    user.liveStatus = 'available';
    user.onSiteTicket = null;
    user.lastStatusUpdate = new Date();
    await user.save();

    emitToRole('admin', 'agent_status_updated', {
      agentId: user._id,
      name: user.name,
      status: 'available',
      ticketId: ticket.ticketId,
      ticketDbId: ticket._id,
      timestamp: user.lastStatusUpdate
    });

    // Location Verification (Hard Rule)
    if (ticket.createdBy?.location?.branch && req.user.location?.branch &&
      ticket.createdBy.location.branch !== req.user.location.branch) {
      ticket.onSiteVisit.locationVerified = false;
      emitToRole('admin', 'location_mismatch_alert', {
        ticketId: ticket.ticketId,
        agentName: req.user.name,
        agentBranch: req.user.location.branch,
        employeeBranch: ticket.createdBy.location.branch,
        timestamp: new Date()
      });
    } else {
      ticket.onSiteVisit.locationVerified = true;
    }

    await ticket.save();

    // Notify employee to confirm arrival
    createNotification({
      recipientId: ticket.createdBy._id,
      type: 'arrival_verification',
      title: 'Agent Arrived',
      message: `${req.user.name} has marked themselves as arrived for your ticket. Please confirm if they are with you.`,
      ticketId: ticket._id,
      triggeredById: req.user._id,
      link: `/tickets/${ticket._id}`
    });

    emitToTicket(ticket._id.toString(), 'agent_arrived', {
      agentId: req.user._id,
      name: req.user.name,
      arrivedAt: ticket.onSiteVisit.arrivedAt
    });

    res.json({ success: true, message: 'Arrival recorded. Waiting for employee confirmation.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Employee confirms agent's arrival
// @route   POST /api/tickets/:id/confirm-arrival
// @access  Private (ticket creator)
const confirmArrival = async (req, res, next) => {
  try {
    const { confirmed } = req.body; // true or false
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the ticket creator can confirm arrival' });
    }

    ticket.onSiteVisit.arrivalConfirmedByEmployee = confirmed;

    // If disputed, notify admin
    if (!confirmed) {
      emitToRole('admin', 'arrival_disputed', {
        ticketId: ticket._id,
        ticketNumber: ticket.ticketId,
        agentId: ticket.assignedTo,
        employeeName: req.user.name
      });
    }

    await ticket.save();
    emitToTicket(ticket._id.toString(), 'arrival_confirmed', { confirmed, confirmedBy: req.user.name });

    res.json({ success: true, message: confirmed ? 'Arrival confirmed. Verified log started.' : 'Dispute recorded. Admin has been notified.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent marks work as resolved (Stage 1: Request Confirmation)
// @route   POST /api/tickets/:id/agent-resolve
// @access  Private (assigned agent)
const agentResolve = async (req, res, next) => {
  try {
    const { notes, type } = req.body;
    if (!notes) return res.status(400).json({ success: false, message: 'Resolution summary is required for accountability.' });
    if (!type) return res.status(400).json({ success: false, message: 'Resolution type is required.' });

    const ticket = await Ticket.findById(req.params.id).populate('createdBy');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can mark as resolved' });
    }

    const oldStatus = ticket.status;
    ticket.status = 'pending_confirmation';
    ticket.resolution = {
      notes,
      type,
      pendingConfirmationAt: new Date(),
      resolvedBy: req.user._id
    };

    ticket.statusHistory.push({
      from: oldStatus,
      to: 'pending_confirmation',
      changedBy: req.user._id,
      reason: 'Agent requested resolution confirmation'
    });

    // Update agent visit status
    if (ticket.onSiteVisit.arrivedAt) {
      ticket.onSiteVisit.visitResolvedAt = new Date();
    }

    // Release agent's live status/lock so they can move to the next thing
    const agent = await User.findById(req.user._id);
    if (agent && agent.onSiteTicket?.toString() === ticket._id.toString()) {
      agent.liveStatus = 'available';
      agent.onSiteTicket = null;
      await agent.save();
    }

    await ticket.save();

    // Trigger employee sign-off notification
    createNotification({
      recipientId: ticket.createdBy._id,
      type: 'resolution_verification',
      title: 'Action Needed: Verify Fix',
      message: `${req.user.name} has marked your ticket ${ticket.ticketId} as resolved. Please verify if the issue is fixed.`,
      ticketId: ticket._id,
      triggeredById: req.user._id,
      link: `/tickets/${ticket._id}`,
      resolutionSummary: notes // Optional field for UI
    });

    // Notify employee via email to verify the fix
    if (ticket.createdBy?.email) {
      sendStatusChangeEmail({
        to: ticket.createdBy.email,
        name: ticket.createdBy.name,
        ticket,
        newStatus: 'resolved'
      }).catch(err => console.error('Failed to send verification request email:', err.message));
    }

    emitToTicket(ticket._id.toString(), 'agent_resolved_request', { notes, type });

    res.json({ success: true, message: 'Resolution request submitted. Awaiting employee confirmation.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent withdraws resolution request
// @route   POST /api/tickets/:id/withdraw-resolve
// @access  Private (assigned agent)
const withdrawResolve = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can withdraw resolution request' });
    }

    if (ticket.status !== 'pending_confirmation') {
      return res.status(400).json({ success: false, message: 'Ticket is not in pending confirmation state.' });
    }

    ticket.status = 'in_progress';
    ticket.statusHistory.push({
      from: 'pending_confirmation',
      to: 'in_progress',
      changedBy: req.user._id,
      reason: 'Agent withdrew resolution request'
    });

    // Clear the pending request data partially
    ticket.resolution.pendingConfirmationAt = null;

    await ticket.save();
    emitToTicket(ticket._id.toString(), 'resolve_withdrawn', { by: req.user.name });

    res.json({ success: true, message: 'Resolution request withdrawn. Ticket is back in-progress.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Employee responds to resolution request (Stage 2: Confirm or Reject)
// @route   POST /api/tickets/:id/confirm-fix
// @access  Private (ticket creator)
const confirmFix = async (req, res, next) => {
  try {
    const { fixed, rating, comment, reason } = req.body; // fixed: true/false
    const ticket = await Ticket.findById(req.params.id).populate('assignedTo');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the ticket creator can verify resolution' });
    }

    if (fixed) {
      // 4A: Employee Confirms Fixed
      ticket.status = 'closed';
      ticket.resolution.resolvedAt = new Date();
      ticket.onSiteVisit.completionConfirmedByEmployee = true;
      ticket.statusHistory.push({ from: 'pending_confirmation', to: 'closed', changedBy: req.user._id, reason: 'Employee confirmed fix' });

      // Save feedback
      ticket.feedback = {
        rating: rating || 5,
        comment: comment || '',
        submittedAt: new Date()
      };

      // Update stats and workload
      if (ticket.assignedTo) {
        const agentId = ticket.assignedTo._id;
        await decrementWorkload(agentId);

        // Update agent metrics & release on-site status
        const agent = await User.findById(agentId);
        if (agent) {
          const totalResolved = (agent.stats?.totalResolved || 0) + 1;
          const currentAvgRating = agent.stats?.avgRating || 0;
          const newAvgRating = ((currentAvgRating * (totalResolved - 1)) + (rating || 5)) / totalResolved;

          agent.stats = {
            ...agent.stats,
            totalResolved,
            avgRating: parseFloat(newAvgRating.toFixed(1))
          };

          // If they were on-site for this specific ticket, set them free
          if (agent.liveStatus === 'on_site' && agent.onSiteTicket?.toString() === ticket._id.toString()) {
            agent.liveStatus = 'available';
            agent.onSiteTicket = null;
          }

          await agent.save();
        }
      }

      // Notify final resolution via email (celebratory)
      await ticket.populate('createdBy', 'name email');
      if (ticket.createdBy?.email) {
        sendResolveEmail({
          to: ticket.createdBy.email,
          name: ticket.createdBy.name,
          ticket
        }).catch(err => console.error('Failed to send final resolution email:', err.message));
      }
    } else {
      // 4B: Employee Rejects Fix
      ticket.status = 'reopened';
      ticket.onSiteVisit.completionConfirmedByEmployee = false;
      ticket.reopenCount = (ticket.reopenCount || 0) + 1;
      ticket.reopenReason = reason || 'Still having problem';
      ticket.lastReopenedAt = new Date();
      ticket.statusHistory.push({ from: 'pending_confirmation', to: 'reopened', changedBy: req.user._id, reason: `Fix rejected: ${reason}` });

      // Clear pending resolution request to allow new one later
      ticket.resolution.pendingConfirmationAt = null;

      // Notify Agent
      if (ticket.assignedTo) {
        createNotification({
          recipientId: ticket.assignedTo._id,
          type: 'resolution_rejected',
          title: 'Resolution Rejected',
          message: `Ticket ${ticket.ticketId} was rejected by the employee. Reason: ${reason}`,
          ticketId: ticket._id,
          triggeredById: req.user._id,
          link: `/tickets/${ticket._id}`
        });
      }

      // Alert Admin
      emitToRole('admin', 'fix_disputed', {
        ticketId: ticket.ticketId,
        agent: ticket.assignedTo?.name,
        reason: reason
      });
    }

    await ticket.save();

    // If fully closed or reopened, we should handle the agent's live status
    if (ticket.assignedTo) {
      const user = await User.findById(ticket.assignedTo._id);
      if (user && user.onSiteTicket?.toString() === ticket._id.toString()) {
        // Only mark available if fixed. If reopened, stay on_site? 
        // User says: "Ticket re-enters agent's queue". 
        // If they were on-site, they might still be there or might have left.
        // For simplicity, we clear on-site ticket on closure. 
        // If rejected, agent is still assigned but not necessarily physically on-site anymore according to the system state.
        if (fixed) {
          user.liveStatus = 'available';
          user.onSiteTicket = null;
          user.lastStatusUpdate = new Date();
          await user.save();

          emitToRole('admin', 'agent_status_updated', {
            agentId: user._id,
            name: user.name,
            status: 'available',
            timestamp: user.lastStatusUpdate
          });
        }
      }
    }

    emitToTicket(ticket._id.toString(), 'fix_verified', { fixed, rating, comment, reason, confirmedBy: req.user.name });

    res.json({ success: true, message: fixed ? 'Ticket successfully resolved and verified.' : 'Ticket reopened. Admin has been notified of the dispute.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent requests hold for a ticket
// @route   POST /api/tickets/:id/request-hold
// @access  Private (assigned agent)
const requestHold = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason for hold is required' });

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the assigned agent can request hold' });
    }

    // Check if this admin already has a ticket on hold (if that's the rule)
    // "Only one admin can hold a ticket at a time" -> interpreted as "An admin can only hold one ticket"
    if (req.user.role === 'admin') {
      const existingHold = await Ticket.findOne({ 'hold.approvedBy': req.user._id, status: 'on_hold' });
      if (existingHold) {
        return res.status(400).json({ success: false, message: `You already have ticket ${existingHold.ticketId} on hold. You can only hold one ticket at a time.` });
      }
    }

    const oldStatus = ticket.status;
    // Use the new holdRequest field
    ticket.holdRequest = {
      reason,
      requestedBy: req.user._id,
      requestedAt: new Date(),
      status: 'pending'
    };

    ticket.statusHistory.push({
      from: oldStatus,
      to: 'pending_hold',
      changedBy: req.user._id,
      reason: `Hold requested: ${reason}`
    });

    await ticket.save();

    // Notify department admin for approval
    // Assuming department admin is available via ticket.assignedDepartment.adminId
    const deptAdmin = await User.findById(ticket.assignedDepartment.adminId);
    if (deptAdmin) {
      createNotification({
        recipientId: deptAdmin._id,
        type: 'hold_request',
        title: 'Hold Request Pending',
        message: `Agent ${req.user.name} requested to put ticket ${ticket.ticketId} on hold. Reason: ${reason}`,
        ticketId: ticket._id
      });
      emitToUser(deptAdmin._id.toString(), 'hold_requested', {
        ticketId: ticket.ticketId,
        agentName: req.user.name,
        reason
      });
    } else {
      // Fallback to super_admin or general admin if no specific dept admin
      emitToRole('super_admin', 'hold_requested', {
        ticketId: ticket.ticketId,
        agentName: req.user.name,
        reason
      });
    }

    res.json({ success: true, message: 'Hold request submitted for team approval.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin reviews hold request
// @route   PATCH /api/tickets/:id/review-hold
// @access  Private (department_admin)
const reviewHold = async (req, res, next) => {
  try {
    const { decision } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be "approved" or "rejected".' });
    }

    const ticket = await Ticket.findById(req.params.id).populate('assignedDepartment');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Ensure admin is from the correct department
    if (req.user.role === 'department_admin' && ticket.assignedDepartment?._id.toString() !== req.user.department?._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only review hold requests for tickets in your department.' });
    }

    if (!ticket.holdRequest || ticket.holdRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending hold request found for this ticket.' });
    }

    ticket.holdRequest.reviewedBy = req.user._id;
    ticket.holdRequest.reviewedAt = new Date();
    ticket.holdRequest.status = decision;

    if (decision === 'approved') {
      ticket.status = 'on_hold';
      ticket.lockedToAdmin = req.user._id; // Feature 20: Lock to approving admin
      ticket.statusHistory.push({
        from: ticket.status, // Current status before hold
        to: 'on_hold',
        changedBy: req.user._id,
        reason: `Hold request approved by ${req.user.name}`
      });
      // Notify agent that hold was approved
      createNotification({
        recipientId: ticket.holdRequest.requestedBy,
        type: 'hold_approved',
        title: 'Hold Request Approved',
        message: `Your hold request for ticket ${ticket.ticketId} has been approved by ${req.user.name}.`,
        ticketId: ticket._id
      });
      emitToUser(ticket.holdRequest.requestedBy.toString(), 'hold_approved', { ticketId: ticket.ticketId, approvedBy: req.user.name });
    } else { // decision === 'rejected'
      // Ticket status remains as it was before the hold request (e.g., 'in_progress')
      // For now, we'll revert to 'in_progress' if it was 'pending_hold'
      ticket.status = 'in_progress'; // Or revert to previous status if stored
      ticket.statusHistory.push({
        from: ticket.status, // Current status before hold
        to: 'in_progress',
        changedBy: req.user._id,
        reason: `Hold request rejected by ${req.user.name}`
      });
      // Notify agent that hold was rejected
      createNotification({
        recipientId: ticket.holdRequest.requestedBy,
        type: 'hold_rejected',
        title: 'Hold Request Rejected',
        message: `Your hold request for ticket ${ticket.ticketId} has been rejected by ${req.user.name}.`,
        ticketId: ticket._id
      });
      emitToUser(ticket.holdRequest.requestedBy.toString(), 'hold_rejected', { ticketId: ticket.ticketId, deniedBy: req.user.name });
    }

    await ticket.save();
    res.json({ success: true, message: `Hold request ${decision} successfully.`, ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin approves hold
// @route   POST /api/tickets/:id/approve-hold
// @access  Private (admin)
// This route is now redundant with reviewHold, but keeping for compatibility if needed.
// It should ideally call reviewHold internally or be removed.
const approveHold = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Check if there's a pending hold request
    if (!ticket.holdRequest || ticket.holdRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending hold request to approve.' });
    }

    // Update holdRequest status
    ticket.holdRequest.status = 'approved';
    ticket.holdRequest.reviewedBy = req.user._id;
    ticket.holdRequest.reviewedAt = new Date();

    // Set ticket status and lock
    const oldStatus = ticket.status;
    ticket.status = 'on_hold';
    ticket.lockedToAdmin = req.user._id; // Feature 20: Lock to approving admin

    ticket.statusHistory.push({
      from: oldStatus,
      to: 'on_hold',
      changedBy: req.user._id,
      reason: 'Hold approved by team'
    });

    await ticket.save();

    // Ensure we release agent status if they were on_site
    const agent = await User.findById(ticket.assignedTo);
    if (agent && agent.liveStatus === 'on_site') {
      agent.liveStatus = 'available';
      agent.onSiteTicket = null;
      await agent.save();
    }

    emitToTicket(ticket._id.toString(), 'hold_approved', { approvedBy: req.user.name });
    emitToRole('support_agent', 'hold_approved', { ticketId: ticket.ticketId, approvedBy: req.user.name });

    res.json({ success: true, message: 'Hold request approved.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin rejects hold
// @route   POST /api/tickets/:id/reject-hold
// @access  Private (admin)
// This route is now redundant with reviewHold, but keeping for compatibility if needed.
// It should ideally call reviewHold internally or be removed.
const rejectHold = async (req, res, next) => {
  try {
    const { denialReason } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    // Check if there's a pending hold request
    if (!ticket.holdRequest || ticket.holdRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending hold request to reject.' });
    }

    // Update holdRequest status
    ticket.holdRequest.status = 'rejected';
    ticket.holdRequest.reviewedBy = req.user._id;
    ticket.holdRequest.reviewedAt = new Date();
    ticket.holdRequest.denialReason = denialReason;

    const oldStatus = ticket.status;
    ticket.status = 'in_progress'; // Revert to in_progress or previous status
    ticket.statusHistory.push({
      from: oldStatus,
      to: 'in_progress',
      changedBy: req.user._id,
      reason: `Hold rejected: ${denialReason || 'No reason provided'}`
    });

    await ticket.save();

    emitToTicket(ticket._id.toString(), 'hold_rejected', { deniedBy: req.user.name, reason: denialReason });

    res.json({ success: true, message: 'Hold request rejected. Ticket is back in progress.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Resume ticket from hold
// @route   POST /api/tickets/:id/resume
// @access  Private (agent/admin)
const resumeTicket = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (ticket.status !== 'on_hold') {
      return res.status(400).json({ success: false, message: 'Ticket is not on hold' });
    }

    // Only the admin who approved it can resume
    if (ticket.lockedToAdmin?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the admin who put this ticket on hold can resume it.' });
    }

    const oldStatus = ticket.status;
    ticket.status = 'in_progress'; // Or revert to previous status
    ticket.holdRequest = null; // Clear hold request after resuming
    ticket.lockedToAdmin = null; // Unlock the ticket

    ticket.statusHistory.push({
      from: oldStatus,
      to: 'in_progress',
      changedBy: req.user._id,
      reason: 'Ticket resumed from hold'
    });

    await ticket.save();

    emitToTicket(ticket._id.toString(), 'ticket_resumed', { resumedBy: req.user.name });

    res.json({ success: true, message: 'Ticket resumed successfully.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent requests reassignment for a ticket
// @route   POST /api/tickets/:id/request-reassign
// @access  Private (agent)
const requestReassign = async (req, res, next) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim().length < 20) {
      return res.status(400).json({ success: false, message: 'Reason must be at least 20 characters.' });
    }

    const ticket = await Ticket.findById(req.params.id).populate('assignedDepartment');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    if (ticket.assignedTo?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only request reassignment for tickets assigned to you.' });
    }

    if (ticket.reassignRequest && ticket.reassignRequest.status === 'pending') {
      return res.status(400).json({ success: false, message: 'Reassignment already requested for this ticket.' });
    }

    ticket.reassignRequest = {
      requestedBy: req.user._id,
      reason,
      status: 'pending',
      requestedAt: new Date()
    };

    await ticket.save();

    // Notify department admin
    const deptAdmin = await User.findById(ticket.assignedDepartment.adminId);
    if (deptAdmin) {
      createNotification({
        recipientId: deptAdmin._id,
        type: 'reassign_request',
        title: 'Reassignment Request Pending',
        message: `Agent ${req.user.name} requested reassignment for ticket ${ticket.ticketId}. Reason: ${reason}`,
        ticketId: ticket._id
      });
      emitToUser(deptAdmin._id.toString(), 'reassign_requested', {
        ticketId: ticket.ticketId,
        agentName: req.user.name,
        reason
      });
    }

    res.json({ success: true, message: 'Reassign request submitted.', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin reviews reassign request
// @route   PATCH /api/tickets/:id/review-reassign
// @access  Private (department_admin)
const reviewReassign = async (req, res, next) => {
  try {
    const { decision } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be "approved" or "rejected".' });
    }

    const ticket = await Ticket.findById(req.params.id).populate('assignedDepartment');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    // Ensure admin is from the correct department
    if (req.user.role === 'department_admin' && ticket.assignedDepartment?._id.toString() !== req.user.department?._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only review reassign requests for tickets in your department.' });
    }

    if (!ticket.reassignRequest || ticket.reassignRequest.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'No pending reassign request found for this ticket.' });
    }

    ticket.reassignRequest.reviewedBy = req.user._id;
    ticket.reassignRequest.reviewedAt = new Date();
    ticket.reassignRequest.status = decision;

    if (decision === 'approved') {
      // Determine current shift
      const hour = new Date().getHours();
      let currentShift;
      if (hour >= 6 && hour < 14) currentShift = 'Morning';
      else if (hour >= 14 && hour < 22) currentShift = 'Mid';
      else currentShift = 'Night';

      // Find best available agent
      const currentAssignedAgentId = ticket.assignedTo;
      const newAgent = await User.findOne({
        department: ticket.assignedDepartment._id,
        userType: 'staff',
        role: 'agent',
        isActive: true,
        shift: currentShift,
        _id: { $ne: currentAssignedAgentId } // Not the current agent
      }).sort({ currentWorkload: 1 }); // Least loaded

      if (newAgent) {
        // Decrement workload for old agent
        if (currentAssignedAgentId) await decrementWorkload(currentAssignedAgentId);
        ticket.assignedTo = newAgent._id;
        ticket.status = 'assigned'; // Or keep previous status if it was in_progress etc.
        await incrementWorkload(newAgent._id);
        // Notify both agents
        createNotification({
          recipientId: currentAssignedAgentId,
          type: 'ticket_reassigned_out',
          title: 'Ticket Reassigned',
          message: `Ticket ${ticket.ticketId} has been reassigned from you to ${newAgent.name}.`,
          ticketId: ticket._id
        });
        createNotification({
          recipientId: newAgent._id,
          type: 'ticket_reassigned_in',
          title: 'New Ticket Reassigned',
          message: `Ticket ${ticket.ticketId} has been reassigned to you.`,
          ticketId: ticket._id
        });
        emitToUser(currentAssignedAgentId.toString(), 'ticket_reassigned', { ticketId: ticket.ticketId, newAgent: newAgent.name });
        emitToUser(newAgent._id.toString(), 'ticket_assigned', { ticketId: ticket.ticketId, assignedBy: req.user.name });
      } else {
        // Fallback: assign to Department Admin
        if (currentAssignedAgentId) await decrementWorkload(currentAssignedAgentId);
        ticket.assignedTo = ticket.assignedDepartment.adminId;
        ticket.status = 'assigned'; // Or keep previous status
        createNotification({
          recipientId: currentAssignedAgentId,
          type: 'ticket_reassigned_out',
          title: 'Ticket Reassigned',
          message: `Ticket ${ticket.ticketId} has been reassigned from you to your Department Admin.`,
          ticketId: ticket._id
        });
        createNotification({
          recipientId: ticket.assignedDepartment.adminId,
          type: 'ticket_assigned_fallback',
          title: 'Ticket Assigned (Fallback)',
          message: `Ticket ${ticket.ticketId} has been assigned to you as no agent was available for reassignment.`,
          ticketId: ticket._id
        });
        emitToUser(currentAssignedAgentId.toString(), 'ticket_reassigned', { ticketId: ticket.ticketId, newAgent: 'Department Admin' });
        emitToUser(ticket.assignedDepartment.adminId.toString(), 'ticket_assigned', { ticketId: ticket.ticketId, assignedBy: req.user.name });
      }
    } else { // decision === 'rejected'
      // Notify agent that reassign was rejected
      createNotification({
        recipientId: ticket.reassignRequest.requestedBy,
        type: 'reassign_rejected',
        title: 'Reassignment Request Rejected',
        message: `Your reassignment request for ticket ${ticket.ticketId} has been rejected by ${req.user.name}.`,
        ticketId: ticket._id
      });
      emitToUser(ticket.reassignRequest.requestedBy.toString(), 'reassign_rejected', { ticketId: ticket.ticketId, deniedBy: req.user.name });
    }

    await ticket.save();
    res.json({ success: true, message: `Reassign request ${decision} successfully.`, ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Agent/Admin sends message to employee
// @route   POST /api/tickets/:id/notify-employee
// @access  Private (agent/department_admin)
const notifyEmployee = async (req, res, next) => {
  try {
    const { message, method } = req.body; // method: 'email' | 'in_app'
    const ticket = await Ticket.findById(req.params.id).populate('createdBy', 'name email');

    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
    if (!message) return res.status(400).json({ success: false, message: 'Message content is required.' });

    if (ticket.category === 'Email Login Issue') {
      // Force in-app message for 'Email Login Issue'
      await sendInAppMessage(ticket.createdBy._id, ticket._id, message, req.user._id);
      return res.status(200).json({ success: true, message: 'In-app message sent (email blocked for this category).' });
    }

    if (method === 'email') {
      // Assuming sendStatusChangeEmail can be repurposed or a new sendCustomEmail is available
      await sendStatusChangeEmail({
        to: ticket.createdBy.email,
        name: ticket.createdBy.name,
        ticket,
        newStatus: ticket.status, // Or a custom status for the email
        customMessage: message
      });
      return res.status(200).json({ success: true, message: 'Email sent to employee.' });
    } else { // Default to in_app
      await sendInAppMessage(ticket.createdBy._id, ticket._id, message, req.user._id);
      return res.status(200).json({ success: true, message: 'In-app message sent.' });
    }
  } catch (err) {
    next(err);
  }
};

const updateTicketDetails = async (req, res, next) => {
  try {
    const { title, description, category, priority, officeLocation, shift, ticketType, subCategory } = req.body;
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    if (!['admin', 'support_agent'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (title) ticket.title = title.trim();
    if (description) ticket.description = description.trim();
    if (category) ticket.category = category;
    if (subCategory) ticket.subCategory = subCategory.trim();
    if (priority) {
      ticket.priority = priority;
      ticket.sla.deadline = calculateSLADeadline(priority);
    }
    if (officeLocation) ticket.officeLocation = officeLocation;
    if (shift) ticket.shift = shift;
    if (ticketType) ticket.ticketType = ticketType;

    await ticket.save();
    emitToTicket(ticket._id.toString(), 'ticket_updated', { ticketId: ticket._id, ticket });

    res.json({ success: true, message: 'Ticket details updated', ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Trigger auto-assignment for a ticket
// @route   PATCH /api/tickets/:id/auto-assign
// @access  Private (admin)
const triggerAutoAssign = async (req, res, next) => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const agent = await autoAssignTicket(ticket);
    if (!agent) return res.status(404).json({ success: false, message: 'No suitable agent found for auto-assignment' });

    // Decrement old agent workload
    if (ticket.assignedTo) await decrementWorkload(ticket.assignedTo);

    ticket.assignedTo = agent._id;
    ticket.assignedAt = new Date();
    ticket.assignedBy = req.user._id;
    ticket.autoAssigned = true;
    
    if (ticket.status === 'open') {
      ticket.status = 'assigned';
      ticket.statusHistory.push({ from: 'open', to: 'assigned', changedBy: req.user._id, reason: 'Triggered auto-assignment' });
    } else {
      ticket.statusHistory.push({ from: ticket.status, to: ticket.status, changedBy: req.user._id, reason: 'Triggered auto-assignment' });
    }

    await ticket.save();
    await incrementWorkload(agent._id);
    await notifyTicketAssigned(ticket, agent, req.user);

    emitToTicket(ticket._id.toString(), 'ticket_assigned', {
      ticketId: ticket._id,
      assignedTo: { _id: agent._id, name: agent.name },
      autoAssigned: true
    });

    res.json({ success: true, message: 'Ticket auto-assigned successfully', agent: { _id: agent._id, name: agent.name } });
  } catch (err) {
    next(err);
  }
};


const acknowledgeTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({
        message: 'Ticket not found'
      });
    }

    // First response timestamp (only once)
    if (!ticket.firstResponseAt) {
      ticket.firstResponseAt = new Date();

      if (ticket.sla) {
        ticket.sla.respondedAt = new Date();
      }

      // Add acknowledgement comment only once
      await Comment.create({
        ticket: ticket._id,
        author: req.user._id,
        content: 'We are working on your issue.',
        isSystem: false
      });
    }

    // Change status
    ticket.status = 'in_progress';

    await ticket.save();

    res.json({
      success: true,
      message: 'Ticket acknowledged'
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: 'Server Error'
    });
  }
};

module.exports = {

  acknowledgeTicket,
  createTicket, getTickets, getTicket, updateStatus,
  assignTicket, reopenTicket, submitFeedback,
  suggestPriority, findSimilarTickets, updatePriority, deleteTicket, updateTicket,
  markArrived, confirmArrival, agentResolve, confirmFix,
  startOnSite, withdrawResolve,
  requestHold, reviewHold, approveHold, rejectHold, resumeTicket,
  requestReassign, reviewReassign, notifyEmployee, updateTicketDetails,
  triggerAutoAssign
};

