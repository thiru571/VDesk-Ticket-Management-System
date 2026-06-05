import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Clock, User, Shield, MessageSquare, Paperclip,
  CheckCircle2, History, RefreshCw, BadgeCheck, Mail, UserCheck,
  Hammer, Trophy, Plus, Activity, ShieldCheck, Briefcase, Send,
  Lock, Star, ChevronRight, Layers, Navigation, MapPin
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { ticketService, commentService, userService, emailService } from '../services/ticketService';
import { timeAgo, formatDateTime, getInitials, getAvatarColor } from '../utils/helpers';
import { Button, Card, Badge, Input } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import TicketLifecycle from '../components/tickets/TicketLifecycle';

const CATEGORY_SUB_MAPPING = {
  'IT': ['Network Issue', 'Software Issue', 'Hardware Issue', 'Access Request', 'Replacement', 'Laptop/Desktop Issue', 'Printer Issue', 'Email Login Issue'],
  'HR': ['Payroll', 'Leave Request', 'Benefits', 'Policy Query', 'Recruitment', 'Onboarding', 'Offboarding'],
  'Finance': ['Invoicing', 'Reimbursement', 'Taxation', 'Audit Support', 'Budgeting'],
  'Admin': ['Facilities', 'Security', 'Office Supplies', 'Event Support', 'ID Card Request'],
  'Operations': ['Logistics', 'Procurement', 'Inventory Management', 'Quality Control'],
  'Marketing': ['Campaign Support', 'Social Media', 'Branding Materials', 'Event Promotion'],
  'Sales': ['Lead Management', 'CRM Support', 'Sales Collateral', 'Client Feedback'],
  'Legal': ['Contract Review', 'Compliance', 'IP Management', 'Legal Documentation'],
  'Other': ['General Query', 'Miscellaneous']
};

const PRIORITY_COLOR = {
  low: { text: '#059669', bg: '#ECFDF5', border: '#6EE7B7' },
  medium: { text: '#2563EB', bg: '#EFF6FF', border: '#93C5FD' },
  high: { text: '#D97706', bg: '#FFFBEB', border: '#FCD34D' },
  critical: { text: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' },
};

const STATUS_COLOR = {
  open: 'info',
  assigned: 'primary',
  in_progress: 'warning',
  on_hold: 'warning',
  pending_hold: 'warning',
  resolved: 'success',
  closed: 'success',
  reopened: 'warning',
};

function InfoRow({ icon, label, value, editing, editNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0', borderBottom: '1px solid var(--border-light)'
    }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {icon} {label}
      </span>
      {editing && editNode ? editNode : (
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{value || 'N/A'}</span>
      )}
    </div>
  );
}

function ActivityDot({ color }) {
  const colors = { green: '#16A34A', blue: '#2563EB', amber: '#D97706', red: '#DC2626', gray: '#94A3B8' };
  return <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[color] || colors.gray, flexShrink: 0, marginTop: '5px' }} />;
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user, updateUser } = useAuth();
  const { on, joinTicket, leaveTicket } = useSocket();
  const toast = useToast();
  const navigate = useNavigate();

  const isAdmin = user?.role === 'admin';
  const isAgent = user?.role === 'support_agent';
  const isAdminOrAgent = isAdmin || isAgent;

  const [ticket, setTicket] = useState(null);
  const [systemAverages, setSystemAverages] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState([]);

  // comment
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isInternal, setIsInternal] = useState(false);

  // feedback
  const [rating, setRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // reassign
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);
  const [reassignReason, setReassignReason] = useState('');
  const [submittingReassign, setSubmittingReassign] = useState(false);

  // ack
  const [ackSent, setAckSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [ackTimer, setAckTimer] = useState(null);
  const [ackMessage, setAckMessage] = useState('');
  const [isAckModalOpen, setIsAckModalOpen] = useState(false);

  // resolution
  const [isResolutionModalOpen, setIsResolutionModalOpen] = useState(false);
  const [resType, setResType] = useState('on_site_fix');
  const [resNotes, setResNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  // hold
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [holdReason, setHoldReason] = useState('');
  const [submittingHold, setSubmittingHold] = useState(false);
  const [isHoldApproveModalOpen, setIsHoldApproveModalOpen] = useState(false);
  const [holdRejectReason, setHoldRejectReason] = useState('');

  // status
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // edit
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', description: '', category: '', priority: '',
    officeLocation: '', shift: '', ticketType: '', subCategory: ''
  });
  const [savingDetails, setSavingDetails] = useState(false);

  const timerRef = useRef(null);
  const isAssignedAgent = isAgent && ticket?.assignedTo?._id === user?._id;

  useEffect(() => {
    fetchAllData();
    if (isAdminOrAgent) fetchAgents();
    if (id) joinTicket(id);
    return () => {
      if (id) leaveTicket(id);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id, user]);

  useEffect(() => {
    if (!ticket || !isAdmin || ticket.emailSource) return;
    if (['resolved', 'closed'].includes(ticket.status)) return;
    if (ticket.firstResponseAt) { setAckSent(true); return; }
    const createdAt = new Date(ticket.createdAt).getTime();
    const ACK_LIMIT = 15 * 60;
    const tick = () => setAckTimer(Math.max(0, ACK_LIMIT - Math.floor((Date.now() - createdAt) / 1000)));
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [ticket?._id, ticket?.status, isAdmin]);

  useEffect(() => {
    if (!on || !id) return;
    const offStatus = on('status_updated', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setTicket(prev => prev ? {
          ...prev, status: data.status,
          firstResponseAt: data.firstResponseAt || prev.firstResponseAt,
          statusHistory: [...(prev.statusHistory || []), { from: prev.status, to: data.status, changedBy: data.changedBy, timestamp: data.timestamp }]
        } : prev);
      }
    });
    const offAssigned = on('ticket_assigned', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setTicket(prev => prev ? { ...prev, assignedTo: data.assignedTo, firstResponseAt: data.firstResponseAt || prev.firstResponseAt, status: prev.status === 'open' ? 'assigned' : prev.status } : prev);
      }
    });
    const offComment = on('new_comment', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setComments(prev => prev.some(c => c._id === data.comment._id) ? prev : [...prev, data.comment]);
      }
    });
    const offPriority = on('priority_updated', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) setTicket(prev => prev ? { ...prev, priority: data.priority } : prev);
    });
    const offReopened = on('ticket_reopened', (data) => {
      if (data.ticketId === id || data.ticketId === ticket?._id) {
        setTicket(prev => prev ? { ...prev, status: 'reopened', statusHistory: [...(prev.statusHistory || []), { from: prev.status, to: 'reopened', reason: data.reason, timestamp: new Date().toISOString() }] } : prev);
      }
    });
    const offHoldRequested = on('hold_requested', (data) => { if (data.ticketId === ticket?.ticketId) { fetchAllData(); toast.info(`Hold requested for ${data.ticketId}`); } });
    const offHoldApproved = on('hold_approved', (data) => { if (data.ticketId === id || data.ticketId === ticket?._id || data.ticketId === ticket?.ticketId) { fetchAllData(); toast.success('Hold approved'); } });
    const offHoldRejected = on('hold_rejected', (data) => { if (data.ticketId === id || data.ticketId === ticket?._id) { fetchAllData(); toast.warning(`Hold rejected: ${data.reason}`); } });
    const offResumed = on('ticket_resumed', (data) => { if (data.ticketId === id || data.ticketId === ticket?._id) { fetchAllData(); toast.success('Ticket resumed'); } });
    return () => { offStatus?.(); offAssigned?.(); offComment?.(); offPriority?.(); offReopened?.(); offHoldRequested?.(); offHoldApproved?.(); offHoldRejected?.(); offResumed?.(); };
  }, [on, id, ticket?._id]);

  const fetchAgents = async () => {
    try { const res = await userService.getAgents(); setAgents(res.data.agents); } catch {}
  };

  const fetchAllData = async () => {
    try {
      if (!ticket) setLoading(true);
      const [ticketRes, commentsRes] = await Promise.all([ticketService.getOne(id), commentService.getAll(id)]);
      const t = ticketRes.data.ticket;
      setTicket(t);
      setSystemAverages(ticketRes.data.systemAverages);
      setComments(commentsRes.data.comments || []);
      setEditForm({ title: t.title, description: t.description, category: t.category, priority: t.priority, officeLocation: t.officeLocation || '', shift: t.shift || '', ticketType: t.ticketType || '', subCategory: t.subCategory || '' });
    } catch (err) {
      toast.error('Failed to load ticket');
      if (!ticket) navigate('/tickets');
    } finally { setLoading(false); }
  };

  // ── Actions ────────────────────────────────────────────────────────────

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const fd = new FormData();
      fd.append('content', commentText);
      fd.append('isInternal', isInternal);
      await commentService.add(id, fd);
      setCommentText(''); setIsInternal(false);
      fetchAllData();
    } catch { toast.error('Failed to post comment'); }
    finally { setSubmittingComment(false); }
  };

  const handleAssign = async (agentId) => {
    try { await ticketService.assign(id, agentId); toast.success('Ticket reassigned!'); fetchAllData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to reassign'); }
  };

  const handleStatusChange = async (newStatus) => {
    setUpdatingStatus(true);
    try { await ticketService.updateStatus(id, { status: newStatus }); toast.success('Status updated'); fetchAllData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to update status'); }
    finally { setUpdatingStatus(false); }
  };

  const handleStartOnSite = async () => {
    try { await ticketService.startOnSite(id); updateUser({ liveStatus: 'on_site' }); toast.success('On-site visit started'); fetchAllData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to start on-site'); }
  };

  const handleMarkArrived = async () => {
    try { await ticketService.markArrived(id); updateUser({ liveStatus: 'available' }); toast.success('Arrival recorded'); fetchAllData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to record arrival'); }
  };

  const handleConfirmArrival = async (confirmed) => {
    try { await ticketService.confirmArrival(id, confirmed); toast.success(confirmed ? 'Arrival confirmed!' : 'Dispute recorded. Admin notified.'); fetchAllData(); }
    catch { toast.error('Failed to confirm arrival'); }
  };

  const handleSendEmail = async (type) => {
    setSendingEmail(true);
    try { await emailService.send({ ticketId: ticket._id, type }); toast.success('Acknowledgement email sent!'); setAckSent(true); fetchAllData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to send email'); }
    finally { setSendingEmail(false); }
  };

  const handleReassignRequest = async () => {
    if (reassignReason.length < 10) return toast.error('Please provide a reason (min 10 characters)');
    setSubmittingReassign(true);
    try { await ticketService.createReassignRequest(id, { reason: reassignReason }); toast.success('Reassignment request sent'); setIsReassignModalOpen(false); setReassignReason(''); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to send request'); }
    finally { setSubmittingReassign(false); }
  };

  const handleRequestHold = async () => {
    if (holdReason.trim().length < 20) return toast.error('Please provide a reason (min 20 characters)');
    setSubmittingHold(true);
    try { await ticketService.requestHold(id, { reason: holdReason }); toast.success('Hold request submitted'); setIsHoldModalOpen(false); setHoldReason(''); fetchAllData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to request hold'); }
    finally { setSubmittingHold(false); }
  };

  const handleApproveHold = async () => {
    try { await ticketService.approveHold(id); toast.success('Hold approved'); fetchAllData(); }
    catch { toast.error('Failed to approve hold'); }
  };

  const handleRejectHold = async () => {
    try { await ticketService.rejectHold(id, { denialReason: holdRejectReason }); toast.success('Hold rejected'); setIsHoldApproveModalOpen(false); fetchAllData(); }
    catch { toast.error('Failed to reject hold'); }
  };

  const handleResumeTicket = async () => {
    try { await ticketService.resumeTicket(id); toast.success('Ticket resumed'); fetchAllData(); }
    catch { toast.error('Failed to resume ticket'); }
  };

  const handleSaveDetails = async () => {
    setSavingDetails(true);
    try { await ticketService.updateDetails(id, editForm); toast.success('Details updated'); setIsEditing(false); fetchAllData(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to update details'); }
    finally { setSavingDetails(false); }
  };

  const handleSubmitFeedback = async () => {
    if (!rating) return;
    setSubmittingFeedback(true);
    try { await ticketService.submitFeedback(id, { rating, comment: feedbackText }); toast.success('Thank you for your feedback!'); fetchAllData(); }
    catch { toast.error('Failed to submit feedback'); }
    finally { setSubmittingFeedback(false); }
  };

  // ✅ NEW: Acknowledge with optional message
  const handleAcknowledge = async () => {
    try {
      await ticketService.acknowledge(ticket._id, { message: ackMessage.trim() || null });
      toast.success('Ticket acknowledged');
      setAckSent(true);
      setIsAckModalOpen(false);
      setAckMessage('');
      fetchAllData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to acknowledge');
    }
  };

  const formatTime = (secs) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) return (
    <div className="page-layout animate-pulse" style={{ padding: '40px' }}>
      <div style={{ height: '32px', width: '200px', marginBottom: '24px' }} className="skeleton" />
      <div style={{ height: '60px', width: '60%', marginBottom: '40px' }} className="skeleton" />
      <div style={{ height: '140px', width: '100%', marginBottom: '40px', borderRadius: '16px' }} className="skeleton" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '28px' }}>
        <div className="flex-col gap-6">
          <div style={{ height: '280px', borderRadius: '16px' }} className="skeleton" />
          <div style={{ height: '400px', borderRadius: '16px' }} className="skeleton" />
        </div>
        <div className="flex-col gap-6">
          <div style={{ height: '300px', borderRadius: '16px' }} className="skeleton" />
          <div style={{ height: '200px', borderRadius: '16px' }} className="skeleton" />
        </div>
      </div>
    </div>
  );
  if (!ticket) return null;

  const isTicketOpen = !['resolved', 'closed'].includes(ticket.status);
  const ackOverdue = ackTimer === 0 && !ackSent;

  const STATUS_PROGRESS = [
    { value: 'open',        label: 'Received',      icon: <Mail size={15} /> },
    { value: 'assigned',    label: 'Assigned',       icon: <UserCheck size={15} /> },
    { value: 'in_progress', label: 'Working on it',  icon: <Hammer size={15} /> },
    { value: 'closed',      label: 'Complete',       icon: <Trophy size={15} /> },
  ];
  const currentStatus =
    ticket.status === 'reopened' ? 'in_progress' :
    ticket.status === 'resolved' ? 'closed' : ticket.status;
  const currentStep = STATUS_PROGRESS.findIndex(s => s.value === currentStatus);

  const pColor = PRIORITY_COLOR[ticket.priority] || PRIORITY_COLOR.medium;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-layout">

      {/* ── ADMIN: 15-min ack banner ─────────────────────────────────── */}
      {isAdmin && isTicketOpen && ackTimer !== null && !ackSent && (
        <div style={{
          marginBottom: '20px', padding: '14px 18px', borderRadius: '12px',
          background: ackOverdue ? '#FEF2F2' : ackTimer < 300 ? '#FFFBEB' : '#F0FDF4',
          border: `1px solid ${ackOverdue ? '#FCA5A5' : ackTimer < 300 ? '#FCD34D' : '#86EFAC'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={18} color={ackOverdue ? '#DC2626' : ackTimer < 300 ? '#D97706' : '#16A34A'} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: ackOverdue ? '#DC2626' : ackTimer < 300 ? '#D97706' : '#15803D' }}>
                {ackOverdue ? 'Reply overdue — employee has been waiting over 15 minutes' : ackTimer < 300 ? 'Less than 5 minutes left — reply soon' : 'Reply within 15 minutes to acknowledge receipt'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Time remaining: <strong style={{ fontVariantNumeric: 'tabular-nums', color: ackOverdue ? '#DC2626' : 'inherit' }}>{ackOverdue ? 'Overdue' : formatTime(ackTimer)}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={() => handleSendEmail('ack')}
            disabled={sendingEmail}
            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: ackOverdue ? '#DC2626' : '#2563EB', color: 'white', fontWeight: 700, fontSize: '0.82rem', opacity: sendingEmail ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}
          >
            <CheckCircle2 size={15} />
            {sendingEmail ? 'Sending...' : 'Send acknowledgement email'}
          </button>
        </div>
      )}

      {ackSent && isAdmin && isTicketOpen && (
        <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '8px', background: '#F0FDF4', border: '1px solid #86EFAC', fontSize: '0.82rem', color: '#15803D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={15} /> Acknowledgement sent — employee knows you received their request.
        </div>
      )}

      {/* ── EMPLOYEE: Journey progress bar ──────────────────────────── */}
      {!isAdminOrAgent && (
        <Card style={{ marginBottom: '24px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', display: 'block' }}>Your request status</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>We'll notify you at each step</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', background: 'var(--bg)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '99px' }}>
              {ticket.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {STATUS_PROGRESS.map((s, i) => {
              const isCompleted = i < currentStep;
              const isActive = i === currentStep;
              return (
                <div key={s.value} style={{ display: 'flex', flex: 1, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 'none' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isCompleted ? '#ECFDF5' : isActive ? '#EFF6FF' : 'var(--bg)',
                      border: `1.5px solid ${isCompleted ? '#16A34A' : isActive ? '#2563EB' : 'var(--border)'}`,
                      color: isCompleted ? '#16A34A' : isActive ? '#2563EB' : 'var(--text-dim)',
                    }}>
                      {isCompleted ? <CheckCircle2 size={16} /> : s.icon}
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-main)' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STATUS_PROGRESS.length - 1 && (
                    <div style={{ flex: 1, height: '1.5px', background: i < currentStep ? '#16A34A' : 'var(--border)', margin: '0 6px', marginBottom: '22px' }} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Lifecycle metrics ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <TicketLifecycle durations={ticket.durations} systemAverages={systemAverages} />
      </div>

      {/* ── ADMIN/AGENT: Status control bar ──────────────────────────── */}
      {isAdminOrAgent && isTicketOpen && (
        <div style={{
          marginBottom: '24px', padding: '12px 16px', borderRadius: '16px',
          border: '1px solid var(--border-light)', background: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={16} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-main)' }}>Status</span>
            <Badge variant={STATUS_COLOR[ticket.status] || 'warning'} style={{ height: '22px', display: 'flex', alignItems: 'center' }}>
              {ticket.status.replace(/_/g, ' ')}
            </Badge>
          </div>

          {/* ✅ UPDATED: Acknowledge gates all other buttons */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {!ticket.firstResponseAt && ['open', 'assigned'].includes(ticket.status) && (
              <button
                onClick={() => setIsAckModalOpen(true)}
                style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #6EE7B7', background: '#ECFDF5', color: '#065F46', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <BadgeCheck size={14} /> Acknowledge ticket
              </button>
            )}
            {ticket.firstResponseAt && (
              <>
                {ticket.status !== 'in_progress' && (
                  <button
                    onClick={() => handleStatusChange('in_progress')}
                    disabled={updatingStatus}
                    style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #93C5FD', background: '#EFF6FF', color: '#1D4ED8', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Hammer size={14} /> Mark as working on it
                  </button>
                )}
                {(isAdmin || isAssignedAgent) && (
                  <>
                    <button
                      onClick={() => setIsHoldModalOpen(true)}
                      disabled={['resolved', 'closed', 'on_hold', 'pending_hold'].includes(ticket.status)}
                      style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #FCD34D', background: '#FFFBEB', color: '#92400E', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: ['resolved', 'closed', 'on_hold', 'pending_hold'].includes(ticket.status) ? 0.5 : 1 }}
                    >
                      <Lock size={14} /> Put on hold
                    </button>
                    <button
                      onClick={() => setIsResolutionModalOpen(true)}
                      disabled={['resolved', 'closed', 'on_hold'].includes(ticket.status)}
                      style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #6EE7B7', background: '#ECFDF5', color: '#065F46', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: ['resolved', 'closed', 'on_hold'].includes(ticket.status) ? 0.5 : 1 }}
                    >
                      <CheckCircle2 size={14} /> Resolve ticket
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Clock size={12} /> Live for {timeAgo(ticket.updatedAt)}
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <button
            onClick={() => navigate('/tickets')}
            style={{ marginTop: '4px', width: '36px', height: '36px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-dim)', flexShrink: 0 }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', background: 'var(--border-light)', padding: '3px 9px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                #{ticket.ticketId || ticket._id.slice(-6).toUpperCase()}
              </span>
              <Badge variant={STATUS_COLOR[ticket.status] || 'warning'}>
                {ticket.status.replace(/_/g, ' ').toUpperCase()}
              </Badge>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: '99px', background: pColor.bg, color: pColor.text, border: `1px solid ${pColor.border}` }}>
                {ticket.priority?.toUpperCase()}
              </span>
            </div>
            {isEditing ? (
              <input
                className="input"
                style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-main)', height: 'auto', padding: '6px 8px' }}
                value={editForm.title}
                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              />
            ) : (
              <h1 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', color: 'var(--text-main)', margin: 0, lineHeight: 1.2 }}>{ticket.title}</h1>
            )}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '6px' }}>
              {ticket.createdBy?.name} · {ticket.category} · {ticket.officeLocation || 'No location'} · {formatDateTime(ticket.createdAt)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {isAdminOrAgent && (
            isEditing ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={handleSaveDetails} isLoading={savingDetails}>Save changes</Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>Edit details</Button>
            )
          )}
          {(isAssignedAgent || isAdmin) && ticket.status === 'on_hold' && (
            <Button size="sm" variant="success" onClick={handleResumeTicket}>Resume ticket</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => navigate('/tickets')} leftIcon={<History size={15} />}>All tickets</Button>
        </div>
      </div>

      {/* ── Hold banner ───────────────────────────────────────────────── */}
      {(ticket.status === 'pending_hold' || ticket.status === 'on_hold') && (
        <div style={{
          marginBottom: '20px', padding: '16px 20px', borderRadius: '12px',
          background: ticket.status === 'pending_hold' ? '#FFFBEB' : '#F8FAFC',
          border: `1px solid ${ticket.status === 'pending_hold' ? '#FDE68A' : '#E2E8F0'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Lock size={20} color={ticket.status === 'pending_hold' ? '#D97706' : '#64748B'} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: ticket.status === 'pending_hold' ? '#92400E' : '#1E293B' }}>
                {ticket.status === 'pending_hold' ? 'Hold approval required' : 'Ticket is currently on hold'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px' }}>Reason: {ticket.hold?.reason}</div>
              {ticket.status === 'on_hold' && ticket.hold?.approvedAt && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Approved {formatDateTime(ticket.hold.approvedAt)}</div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isAdmin && ticket.status === 'pending_hold' && (
              <Button size="sm" onClick={() => setIsHoldApproveModalOpen(true)}>Review hold request</Button>
            )}
            {(isAdmin || isAssignedAgent) && ticket.status === 'on_hold' && (
              <Button size="sm" variant="success" onClick={handleResumeTicket}>Resume now</Button>
            )}
          </div>
        </div>
      )}

      {/* ── On-site visit workflow ────────────────────────────────────── */}
      {(isAssignedAgent || user?._id === ticket.createdBy?._id || isAdmin) && (
        <div style={{
          marginBottom: '20px', padding: '16px 20px', borderRadius: '12px',
          background: '#F0F9FF', border: '1px solid #BAE6FD',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            <Navigation size={20} color="#0369A1" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0C4A6E', marginBottom: '2px' }}>On-site visit protocol</div>
              <div style={{ fontSize: '0.8rem', color: '#0369A1' }}>
                {isAssignedAgent ? (
                  ticket.onSiteVisit?.arrivalConfirmedByEmployee ? 'Arrived & verified. You are on-site.' :
                  ticket.onSiteVisit?.arrivedAt ? 'Arrival recorded — waiting for employee confirmation.' :
                  ticket.onSiteVisit?.requestedAt ? 'Travelling — click Arrived once you reach the location.' :
                  'Heading over? Start the visit protocol.'
                ) : (
                  ticket.onSiteVisit?.arrivedAt && !ticket.onSiteVisit?.arrivalConfirmedByEmployee ? 'Agent says they arrived. Can you confirm?' :
                  ticket.onSiteVisit?.arrivalConfirmedByEmployee ? 'Agent is currently working on your issue.' :
                  ticket.onSiteVisit?.requestedAt ? 'Agent is on the way.' :
                  'A support visit may be needed for this issue.'
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {isAssignedAgent && !ticket.onSiteVisit?.requestedAt && (
              <Button size="sm" onClick={handleStartOnSite} disabled={!isTicketOpen} leftIcon={<Navigation size={14} />}>Go on-site</Button>
            )}
            {isAssignedAgent && ticket.onSiteVisit?.requestedAt && !ticket.onSiteVisit?.arrivedAt && (
              <Button size="sm" variant="warning" onClick={handleMarkArrived} disabled={!isTicketOpen} leftIcon={<MapPin size={14} />}>I have arrived</Button>
            )}
            {isAssignedAgent && ticket.onSiteVisit?.arrivedAt && !ticket.onSiteVisit?.visitResolvedAt && (
              <Button size="sm" variant="success" onClick={() => setIsResolutionModalOpen(true)} disabled={!isTicketOpen} leftIcon={<CheckCircle2 size={14} />}>Resolve issue</Button>
            )}
            {user?._id === ticket.createdBy?._id && ticket.onSiteVisit?.arrivedAt && !ticket.onSiteVisit?.arrivalConfirmedByEmployee && (
              <>
                <Button size="sm" variant="success" onClick={() => handleConfirmArrival(true)}>Yes, agent is here</Button>
                <Button size="sm" variant="danger" onClick={() => handleConfirmArrival(false)}>No, not here</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px', alignItems: 'start' }}>

        {/* LEFT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Description card */}
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', background: getAvatarColor(ticket.createdBy?.name), borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                  {getInitials(ticket.createdBy?.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{ticket.createdBy?.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{ticket.createdBy?.email}</div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>{formatDateTime(ticket.createdAt)}</div>
            </div>
            <div style={{ paddingTop: '14px', borderTop: '1px solid var(--border-light)', lineHeight: 1.75, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {isEditing ? (
                <textarea
                  className="input"
                  style={{ minHeight: '140px', padding: '10px', lineHeight: 1.7 }}
                  value={editForm.description}
                  onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                />
              ) : ticket.description}
            </div>
          </Card>

          {/* Resolution card */}
          {(ticket.status === 'resolved' || ticket.status === 'closed') && ticket.resolution && (
            <div style={{ padding: '16px 20px', borderRadius: '12px', background: '#ECFDF5', border: '1px solid #6EE7B7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#065F46', marginBottom: '8px', fontSize: '0.875rem' }}>
                <CheckCircle2 size={16} /> Resolution details
              </div>
              <p style={{ fontSize: '0.875rem', color: '#065F46', lineHeight: 1.7, margin: 0 }}>
                {ticket.resolution.notes || 'This issue has been successfully resolved.'}
              </p>
              <div style={{ fontSize: '0.72rem', color: '#6EE7B7', marginTop: '8px' }}>
                Resolved {formatDateTime(ticket.resolution.resolvedAt || ticket.updatedAt)}
              </div>
            </div>
          )}

          {/* Messages */}
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingLeft: '2px' }}>
              <MessageSquare size={16} /> Messages & replies
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {comments.map(comment => (
                <Card key={comment._id} style={{ padding: '14px 16px', background: comment.isInternal ? '#FFFBEB' : 'white', border: comment.isInternal ? '1px solid #FDE68A' : '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '24px', height: '24px', background: getAvatarColor(comment.author?.name), borderRadius: '6px', color: 'white', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                        {getInitials(comment.author?.name)}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{comment.author?.name}</span>
                      {comment.isInternal && (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '99px', background: '#FAEEDA', color: '#92400E', border: '1px solid #FCD34D', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Lock size={9} /> Staff only
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>{timeAgo(comment.createdAt)}</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.65 }}>{comment.content}</div>
                </Card>
              ))}
            </div>

            {/* Comment input */}
            <Card style={{ marginTop: '12px', padding: '14px 16px', border: isInternal ? '2px solid #FCD34D' : '1px solid var(--border)' }}>
              {isInternal && (
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#92400E', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Lock size={11} /> Staff-only note — employee cannot see this
                </div>
              )}
              <form onSubmit={handlePostComment}>
                <textarea
                  className="input"
                  style={{ height: '80px', paddingTop: '10px', marginBottom: '12px', border: 'none', background: 'var(--bg)', borderRadius: '8px' }}
                  placeholder={isInternal ? 'Write a private staff note...' : 'Write your reply here...'}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="ghost" size="sm" leftIcon={<Paperclip size={14} />} type="button">Attach</Button>
                    {isAdminOrAgent && (
                      <Button
                        variant={isInternal ? 'warning' : 'ghost'}
                        size="sm"
                        leftIcon={<Lock size={14} />}
                        onClick={() => setIsInternal(!isInternal)}
                        type="button"
                      >
                        {isInternal ? 'Staff note on' : 'Staff only'}
                      </Button>
                    )}
                  </div>
                  <Button size="sm" type="submit" variant={isInternal ? 'warning' : 'primary'} isLoading={submittingComment} rightIcon={<Send size={13} />}>
                    {isInternal ? 'Post note' : 'Send reply'}
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </div>

        {/* RIGHT sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Assigned specialist */}
          <Card>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <User size={13} /> Assigned specialist
            </div>
            {isAdmin ? (
              <div style={{ position: 'relative' }}>
                <select
                  style={{ width: '100%', appearance: 'none', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '0.875rem', fontWeight: 600, padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', color: 'var(--text-main)' }}
                  value={ticket.assignedTo?._id || ''}
                  onChange={e => handleAssign(e.target.value)}
                >
                  <option value="">Unassigned — select agent</option>
                  {agents.map(a => (
                    <option key={a._id} value={a._id}>{a.name} ({a.currentWorkload} active)</option>
                  ))}
                </select>
                <ChevronRight size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%) rotate(90deg)', pointerEvents: 'none', color: 'var(--text-dim)' }} />
              </div>
            ) : ticket.assignedTo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ width: '34px', height: '34px', background: getAvatarColor(ticket.assignedTo.name), borderRadius: '8px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                  {getInitials(ticket.assignedTo.name)}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{ticket.assignedTo.name}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>Support specialist</div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '14px', borderRadius: '10px', border: '2px dashed var(--border)', textAlign: 'center', background: 'var(--bg)' }}>
                <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem', fontStyle: 'italic' }}>Pending assignment</span>
              </div>
            )}
            {isAgent && isAssignedAgent && (
              <button
                onClick={() => setIsReassignModalOpen(true)}
                style={{ marginTop: '8px', width: '100%', padding: '7px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-dim)', fontWeight: 600 }}
              >
                Request transfer
              </button>
            )}
          </Card>

          {/* Ticket properties */}
          <Card>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Shield size={13} /> Ticket properties
            </div>

            <InfoRow icon={<Activity size={12} />} label="Status" value={null} editNode={null}>
              <Badge variant={STATUS_COLOR[ticket.status] || 'warning'} style={{ fontSize: '0.7rem' }}>
                {ticket.status.replace(/_/g, ' ')}
              </Badge>
            </InfoRow>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <ShieldCheck size={12} /> Priority
              </span>
              {isEditing ? (
                <select className="input" style={{ height: '28px', fontSize: '0.78rem', padding: '0 6px', width: 'auto' }} value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))}>
                  {['low', 'medium', 'high', 'critical'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', background: pColor.bg, color: pColor.text, border: `1px solid ${pColor.border}` }}>
                  {ticket.priority}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <Briefcase size={12} /> Category
              </span>
              {isEditing ? (
                <select className="input" style={{ height: '28px', fontSize: '0.78rem', padding: '0 6px', width: 'auto' }} value={editForm.category} onChange={e => setEditForm(p => ({ ...p, category: e.target.value, subCategory: '' }))}>
                  {Object.keys(CATEGORY_SUB_MAPPING).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{ticket.category}</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <Layers size={12} /> Sub-category
              </span>
              {isEditing ? (
                <select className="input" style={{ height: '28px', fontSize: '0.78rem', padding: '0 6px', width: 'auto' }} value={editForm.subCategory} onChange={e => setEditForm(p => ({ ...p, subCategory: e.target.value }))}>
                  <option value="">Select...</option>
                  {(CATEGORY_SUB_MAPPING[editForm.category] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{ticket.subCategory || 'N/A'}</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <MapPin size={12} /> Location
              </span>
              {isEditing ? (
                <select className="input" style={{ height: '28px', fontSize: '0.78rem', padding: '0 6px', width: 'auto' }} value={editForm.officeLocation} onChange={e => setEditForm(p => ({ ...p, officeLocation: e.target.value }))}>
                  {['GICC', 'Bangalore', 'Remote', 'Other'].map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{ticket.officeLocation || 'N/A'}</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <Clock size={12} /> Shift
              </span>
              {isEditing ? (
                <select className="input" style={{ height: '28px', fontSize: '0.78rem', padding: '0 6px', width: 'auto' }} value={editForm.shift} onChange={e => setEditForm(p => ({ ...p, shift: e.target.value }))}>
                  {['Morning', 'Mid', 'Night'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{ticket.shift || 'N/A'}</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <RefreshCw size={12} /> Type
              </span>
              {isEditing ? (
                <select className="input" style={{ height: '28px', fontSize: '0.78rem', padding: '0 6px', width: 'auto' }} value={editForm.ticketType} onChange={e => setEditForm(p => ({ ...p, ticketType: e.target.value }))}>
                  {['Service Request', 'Incident', 'Question'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-main)' }}>{ticket.ticketType || 'N/A'}</span>
              )}
            </div>
          </Card>

          {/* Activity log */}
          <Card>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
              <History size={13} /> Activity log
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', flexShrink: 0, marginTop: '4px' }} />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Ticket created</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={10} /> {timeAgo(ticket.createdAt)}
                  </div>
                </div>
              </div>
              {ticket.statusHistory?.map((h, idx) => {
                const isResolved = h.to === 'resolved' || h.to === 'closed';
                return (
                  <div key={h._id || idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isResolved ? '#16A34A' : '#D97706', flexShrink: 0, marginTop: '4px' }} />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Moved to <span style={{ color: isResolved ? '#16A34A' : '#D97706' }}>{h.to?.replace(/_/g, ' ')}</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={10} /> {h.changedBy?.name || 'System'} · {timeAgo(h.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Feedback */}
          <Card>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Star size={13} /> How was your experience?
            </div>
            {ticket.feedback?.rating ? (
              <div>
                <div style={{ display: 'flex', gap: '3px', marginBottom: '8px' }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} fill={i < ticket.feedback.rating ? '#F59E0B' : 'none'} color="#F59E0B" />
                  ))}
                </div>
                {ticket.feedback.comment && (
                  <p style={{ fontSize: '0.82rem', fontStyle: 'italic', color: 'var(--text-muted)', lineHeight: 1.6 }}>"{ticket.feedback.comment}"</p>
                )}
              </div>
            ) : ticket.status === 'resolved' && user?._id === ticket.createdBy?._id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} onClick={() => setRating(star)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      <Star size={22} fill={star <= rating ? '#F59E0B' : 'none'} color="#F59E0B" />
                    </button>
                  ))}
                </div>
                <textarea
                  className="input"
                  placeholder="Tell us about your experience..."
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  style={{ minHeight: '60px', padding: '8px', fontSize: '0.8rem' }}
                />
                <Button size="sm" onClick={handleSubmitFeedback} disabled={!rating} isLoading={submittingFeedback}>
                  Submit & close
                </Button>
              </div>
            ) : (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                {ticket.status === 'resolved' ? 'You can now rate how this was handled.' : 'Rating available once the ticket is resolved.'}
              </p>
            )}
          </Card>
        </div>
      </div>

      {/* ── MODALS ────────────────────────────────────────────────────────── */}

      {/* Reassign modal */}
      {isReassignModalOpen && (
        <div className="modal-overlay" onClick={() => setIsReassignModalOpen(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <h3 style={{ marginBottom: '8px', fontWeight: 800 }}>Request ticket transfer</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '16px' }}>Explain why this ticket should be transferred to another agent.</p>
            <textarea className="input" style={{ height: '100px', marginBottom: '20px' }} placeholder="Reason for transfer..." value={reassignReason} onChange={e => setReassignReason(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <Button variant="ghost" onClick={() => setIsReassignModalOpen(false)}>Cancel</Button>
              <Button onClick={handleReassignRequest} isLoading={submittingReassign}>Send request</Button>
            </div>
          </motion.div>
        </div>
      )}

      <AnimatePresence>

        {/* Resolution modal */}
        {isResolutionModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '28px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.2)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '6px' }}>Mark as resolved</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '20px' }}>Provide a summary of what was done for the accountability record.</p>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>Resolution summary (required)</label>
              <textarea className="input" style={{ height: '110px', padding: '12px', borderRadius: '12px', marginBottom: '20px' }} placeholder="e.g. Replaced cable, reconfigured switch..." value={resNotes} onChange={e => setResNotes(e.target.value)} />
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '10px', textTransform: 'uppercase' }}>Resolution type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px' }}>
                {[
                  { id: 'on_site_fix', label: 'On-site fix' },
                  { id: 'remote_fix', label: 'Remote fix' },
                  { id: 'guided_employee', label: 'Guided employee' },
                  { id: 'config_change', label: 'Config change' },
                  { id: 'other', label: 'Other' },
                ].map(opt => (
                  <div key={opt.id} onClick={() => setResType(opt.id)} style={{ padding: '10px 12px', border: `1px solid ${resType === opt.id ? '#93C5FD' : 'var(--border)'}`, borderRadius: '10px', cursor: 'pointer', textAlign: 'center', fontSize: '0.82rem', fontWeight: 700, background: resType === opt.id ? '#EFF6FF' : 'white', color: resType === opt.id ? '#1D4ED8' : 'var(--text-dim)' }}>
                    {opt.label}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="ghost" fullWidth onClick={() => setIsResolutionModalOpen(false)}>Cancel</Button>
                <Button fullWidth onClick={async () => {
                  if (!resNotes.trim()) return toast.error('Please provide a resolution summary.');
                  setIsResolving(true);
                  try {
                    await ticketService.updateStatus(id, { status: 'resolved', resolutionNotes: resNotes, resolutionType: resType });
                    toast.success('Ticket resolved!');
                    setIsResolutionModalOpen(false);
                    setResNotes('');
                    fetchAllData();
                  } catch (err) { toast.error(err.response?.data?.message || 'Failed to resolve'); }
                  finally { setIsResolving(false); }
                }} isLoading={isResolving}>Mark as resolved</Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Hold request modal */}
        {isHoldModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '28px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '6px' }}>Request to hold ticket</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '6px' }}>Provide a reason. This will need admin approval.</p>
              <p style={{ fontSize: '0.75rem', marginBottom: '14px', color: holdReason.length >= 20 ? '#16A34A' : '#DC2626' }}>{holdReason.length}/20 characters minimum</p>
              <textarea className="input" style={{ height: '110px', padding: '12px', borderRadius: '12px', marginBottom: '24px' }} placeholder="e.g. Waiting for hardware delivery, user is out of office..." value={holdReason} onChange={e => setHoldReason(e.target.value)} />
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="ghost" fullWidth onClick={() => { setIsHoldModalOpen(false); setHoldReason(''); }}>Cancel</Button>
                <Button fullWidth onClick={handleRequestHold} isLoading={submittingHold} disabled={holdReason.length < 20}>Submit request</Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Hold approve/reject modal */}
        {isHoldApproveModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '28px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '12px' }}>Review hold request</h2>
              <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: '10px', marginBottom: '18px', fontSize: '0.875rem', lineHeight: 1.6 }}>
                <strong>Reason:</strong> {ticket.hold?.reason}
              </div>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>Denial reason (if rejecting)</label>
              <textarea className="input" style={{ height: '80px', padding: '10px', borderRadius: '10px', marginBottom: '20px' }} placeholder="Why is this hold rejected?" value={holdRejectReason} onChange={e => setHoldRejectReason(e.target.value)} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="ghost" fullWidth onClick={() => setIsHoldApproveModalOpen(false)}>Close</Button>
                <Button variant="danger" fullWidth onClick={handleRejectHold}>Reject</Button>
                <Button variant="success" fullWidth onClick={handleApproveHold}>Approve hold</Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* ✅ NEW: Acknowledge modal */}
        {isAckModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '28px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '6px' }}>Acknowledge ticket</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '18px' }}>
                Optionally send a message to the employee letting them know you've picked this up.
              </p>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Message <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <textarea
                className="input"
                style={{ height: '100px', padding: '12px', borderRadius: '12px', marginBottom: '24px' }}
                placeholder="e.g. Hi, I've received your request and will look into it shortly..."
                value={ackMessage}
                onChange={e => setAckMessage(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="ghost" fullWidth onClick={() => { setIsAckModalOpen(false); setAckMessage(''); }}>Cancel</Button>
                <Button fullWidth onClick={handleAcknowledge} leftIcon={<BadgeCheck size={15} />}>
                  {ackMessage.trim() ? 'Acknowledge & send' : 'Acknowledge'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}

      </AnimatePresence>
    </motion.div>
  );
}