const express = require('express');
const {
  createTicket, getTickets, getTicket, updateStatus,
  assignTicket, reopenTicket, submitFeedback,
  suggestPriority, findSimilarTickets, updatePriority, deleteTicket, updateTicket,
  markArrived, confirmArrival, agentResolve, confirmFix, 
  startOnSite, withdrawResolve, 
  requestHold, reviewHold, approveHold, rejectHold, resumeTicket,
  requestReassign, reviewReassign, notifyEmployee
} = require('../controllers/ticket.controller');
const { createReassignRequest, getReassignRequests, processReassignRequest } = require('../controllers/reassign.controller');
const { protect, authorizeRoles, authorizeEmployee, authorizeStaff } = require('../middleware/rbac.middleware');
const upload = require('../middleware/upload'); // Assuming you have a multer upload middleware

const router = express.Router();

router.post('/', protect, authorizeEmployee, upload.array('attachments', 5), createTicket);
router.get('/', protect, getTickets);
router.get('/suggest-priority', protect, suggestPriority);
router.get('/similar', protect, findSimilarTickets);
router.get('/:id', protect, getTicket);
router.patch('/:id/status', protect, authorizeStaff, updateStatus); // Staff can update status
router.patch('/:id/assign', protect, authorizeRoles('super_admin', 'department_admin'), assignTicket);
router.patch('/:id/priority', protect, authorizeRoles('super_admin', 'department_admin'), updatePriority);
router.delete('/:id', protect, authorizeRoles('super_admin'), deleteTicket); // Only super admin can delete
router.put('/:id', protect, authorizeRoles('super_admin', 'department_admin'), updateTicket); // Super/Dept admin can update

// On-site workflow
router.post('/:id/start-onsite', protect, authorizeRoles('agent'), startOnSite);
router.post('/:id/arrive', protect, authorizeRoles('agent'), markArrived);
router.post('/:id/confirm-arrival', protect, authorizeEmployee, confirmArrival);
router.post('/:id/agent-resolve', protect, authorizeRoles('agent'), agentResolve);
router.post('/:id/withdraw-resolve', protect, authorizeRoles('agent'), withdrawResolve);
router.post('/:id/confirm-fix', protect, authorizeEmployee, confirmFix);

// Hold requests
router.post('/:id/request-hold', protect, authorizeRoles('agent'), requestHold); // New
router.patch('/:id/review-hold', protect, authorizeRoles('super_admin', 'department_admin'), reviewHold); // New
router.post('/:id/approve-hold', protect, authorizeRoles('super_admin', 'department_admin'), approveHold); // Existing, kept for now
router.post('/:id/reject-hold', protect, authorizeRoles('super_admin', 'department_admin'), rejectHold); // Existing, kept for now
router.post('/:id/resume', protect, authorizeRoles('super_admin', 'department_admin'), resumeTicket); // Existing, kept for now

// Reassign requests
router.post('/:id/request-reassign', protect, authorizeRoles('agent'), requestReassign); // New
router.patch('/:id/review-reassign', protect, authorizeRoles('super_admin', 'department_admin'), reviewReassign); // New

// Reassignment requests
router.post('/:id/reassign-request', protect, authorizeRoles('agent'), createReassignRequest);
router.get('/reassign/requests', protect, authorizeRoles('super_admin', 'department_admin'), getReassignRequests);
router.patch('/reassign/requests/:requestId', protect, authorizeRoles('super_admin', 'department_admin'), processReassignRequest);

// Employee actions
router.patch('/:id/reopen', protect, authorizeEmployee, reopenTicket);
router.post('/:id/feedback', protect, authorizeEmployee, submitFeedback);

// Agent Communication
router.post('/:id/notify-employee', protect, authorizeRoles('agent', 'department_admin'), notifyEmployee); // New

module.exports = router;