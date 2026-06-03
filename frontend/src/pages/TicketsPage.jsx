import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Search, Plus, ChevronLeft, ChevronRight, ArrowUpDown,
  Clock, MoreHorizontal, Eye, Trash2, CheckSquare,
  Mail, LayoutList, LayoutDashboard
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ticketService } from '../services/ticketService';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { Button, Badge, Modal } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';

export default function TicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [systemAverages, setSystemAverages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [viewMode, setViewMode] = useState(localStorage.getItem('ticketViewMode') || 'list');
  const [activeMenu, setActiveMenu] = useState(null);
  const [confirmData, setConfirmData] = useState({
    isOpen: false, ticketId: null, newStatus: null, currentStatus: null, message: ''
  });

  const toast = useToast();
  const { on } = useSocket();

  // ── Derive filters directly from searchParams (no separate filters state) ──
  const filters = {
    status:    searchParams.get('status')    || '',
    priority:  searchParams.get('priority')  || '',
    category:  searchParams.get('category')  || '',
    search:    searchParams.get('search')    || '',
    office:    searchParams.get('office')    || '',
    team:      searchParams.get('team')      || '',
    myTickets: searchParams.get('myTickets') || '',
    page:      searchParams.get('page')      || '1',
  };

  // ── Single filter change helper — updates URL only; effect re-runs ──────────
  const handleFilterChange = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    // Reset to page 1 on any filter change (except explicit page changes)
    if (key !== 'page') next.set('page', '1');
    setSearchParams(next);
  };

  // ── Fetch — reads from searchParams directly, no stale-closure risk ─────────
  const fetchTickets = useCallback(() => {
    setLoading(true);

    const clean = (v) => (!v || v === 'All' ? undefined : v);
    const activeStatuses = 'open,assigned,in_progress,reopened';
    const rawStatus = clean(filters.status);
    const statusFilter = rawStatus || (filters.myTickets === 'true' ? activeStatuses : '');

    const params = {
      page:  filters.page || 1,
      limit: 10,
      ...(statusFilter                ? { status:    statusFilter          } : {}),
      ...(clean(filters.priority)     ? { priority:  clean(filters.priority)  } : {}),
      ...(clean(filters.category)     ? { category:  clean(filters.category)  } : {}),
      ...(clean(filters.search)       ? { search:    clean(filters.search)    } : {}),
      ...(clean(filters.office)       ? { office:    clean(filters.office)    } : {}),
      ...(clean(filters.team)         ? { team:      clean(filters.team)      } : {}),
      ...(filters.myTickets === 'true' ? { myTickets: 'true'                  } : {}),
    };

    ticketService.getAll(params)
      .then(res => {
        setTickets(res.data.tickets);
        setSystemAverages(res.data.systemAverages);
        setPagination({
          page:       res.data.pagination?.page  || 1,
          totalPages: res.data.pagination?.pages || 1,
        });
      })
      .catch(() => toast.error('Failed to load tickets'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // ← only searchParams; no filters object dependency

  // ── ONE effect — fires once per searchParams change ──────────────────────────
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // ── Socket listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    const offCreated = on('ticket_created', (data) => {
      if (data.ticket && filters.page === '1') {
        setTickets(prev => {
          if (prev.some(t => t._id === data.ticket._id)) return prev;
          return [data.ticket, ...prev].slice(0, 10);
        });
        toast.info(`New Ticket: ${data.ticket.title || 'Support Request received'}`);
      }
    });
    const offStatus   = on('ticket_status_changed',     (data) => updateTicket(data.ticketId, { status: data.status }));
    const offAssign   = on('ticket_assignment_changed', (data) => updateTicket(data.ticketId, { assignedTo: data.assignedTo, status: data.status }));
    const offPriority = on('ticket_priority_changed',   (data) => updateTicket(data.ticketId, { priority: data.priority }));
    const offSLA      = on('sla:update', (data) => {
      setTickets(prev => prev.map(t => {
        const u = data.tickets.find(x => x.id === t._id);
        return u ? { ...t, slaScore: u.slaScore, slaStatus: u.slaStatus, sla: { ...t.sla, risk: u.slaRisk } } : t;
      }));
    });

    return () => { offCreated?.(); offStatus?.(); offAssign?.(); offPriority?.(); offSLA?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, filters.page]);

  const updateTicket = (ticketId, patch) => {
    setTickets(prev => prev.map(t =>
      t._id === ticketId?.toString()
        ? { ...t, ...patch, updatedAt: new Date().toISOString() }
        : t
    ));
  };

  // ── Close dropdown on outside click ─────────────────────────────────────────
  useEffect(() => {
    const close = () => setActiveMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleAction = async (ticketId, action, e) => {
    e.stopPropagation();
    setActiveMenu(null);
    try {
      if (action === 'delete') {
        if (!window.confirm('Are you sure you want to delete this ticket?')) return;
        await ticketService.delete(ticketId);
        toast.success('Ticket deleted');
        fetchTickets();
      } else if (action === 'resolve') {
        await ticketService.updateStatus(ticketId, { status: 'resolved' });
        toast.success('Ticket marked as resolved');
        fetchTickets();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  };

  const handleStatusChange = (ticketId, newStatus, currentStatus) => {
    if (!ticketId || !newStatus || newStatus === currentStatus) return;
    const ORDER = ['assigned', 'in_progress', 'closed'];
    if (ORDER.indexOf(newStatus) < ORDER.indexOf(currentStatus)) {
      return toast.warning(`Cannot move ticket back to "${newStatus.replace(/_/g, ' ')}"`);
    }
    setConfirmData({
      isOpen: true, ticketId, newStatus, currentStatus,
      message: newStatus === 'closed'
        ? 'Move to closed? This will mark the ticket as done.'
        : `Move ticket to "${newStatus.replace(/_/g, ' ')}"?`,
    });
  };

  const executeStatusChange = async () => {
    const { ticketId, newStatus } = confirmData;
    setConfirmData(p => ({ ...p, isOpen: false }));
    try {
      await ticketService.updateStatus(ticketId, { status: newStatus });
      toast.success(`Ticket moved to "${newStatus.replace(/_/g, ' ')}"`);
      fetchTickets();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const KANBAN_COLUMNS = [
    { id: 'assigned',   title: 'Assigned',    color: 'var(--primary)' },
    { id: 'in_progress', title: 'In Progress', color: 'var(--warning)' },
    { id: 'closed',     title: 'Closed',      color: 'var(--success)' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-layout">

      <div className="flex-between mb-8">
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, letterSpacing: '-0.025em' }}>
            {filters.myTickets ? 'My Support Queue' : 'Support Tickets'}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {filters.myTickets
              ? `Working on ${tickets.length} active assignments.`
              : 'Overview of all tickets across the organization.'}
          </p>
        </div>
      </div>

      {/* ── Filters bar ── */}
      <div style={{
        background: 'white', padding: '16px 24px', borderRadius: '20px',
        border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '24px', marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search by ID, subject or content..."
              style={{
                width: '100%', padding: '10px 16px 10px 42px', borderRadius: '12px',
                border: '1px solid var(--border)', background: 'var(--surface-alt)',
                fontSize: '0.9rem', fontWeight: 600, outline: 'none',
              }}
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
            />
          </div>

          <div style={{ height: '24px', width: '1px', background: 'var(--border-light)' }} />

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</span>
            <select
              style={{ padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', minWidth: '130px', outline: 'none' }}
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
            >
              <option value="">{filters.myTickets === 'true' ? 'All Active' : 'All Statuses'}</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">Working on it</option>
              <option value="almost_complete">Almost done</option>
              <option value="resolved">Fixed</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Priority */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Priority</span>
            <select
              style={{ padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', background: 'white', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', minWidth: '100px', outline: 'none' }}
              value={filters.priority}
              onChange={e => handleFilterChange('priority', e.target.value)}
            >
              <option value="">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>

        {/* View mode + New Ticket */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--surface-alt)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex' }}>
            {[
              { id: 'list',  icon: <LayoutList size={14} />,      label: 'LI' },
              { id: 'panel', icon: <LayoutDashboard size={14} />, label: 'PA' },
              { id: 'board', icon: <LayoutDashboard size={14} />, label: 'BO' },
            ].map(v => (
              <button key={v.id}
                onClick={() => { setViewMode(v.id); localStorage.setItem('ticketViewMode', v.id); }}
                style={{
                  padding: '6px 10px', borderRadius: '6px', border: 'none',
                  background: viewMode === v.id ? 'white' : 'transparent',
                  boxShadow: viewMode === v.id ? 'var(--shadow-sm)' : 'none',
                  color: viewMode === v.id ? 'var(--primary)' : 'var(--text-dim)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.75rem',
                }}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {user?.role === 'employee' && (
            <Button variant="primary" size="sm"
              style={{ fontWeight: 800, padding: '8px 20px', borderRadius: '12px' }}
              onClick={() => navigate('/tickets/new')}
              leftIcon={<Plus size={18} />}
            >
              New Ticket
            </Button>
          )}
        </div>
      </div>

      {/* ── Secondary filters ── */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { label: 'Office', key: 'office', options: [['', 'All Offices'], ['GICC', 'GICC (VP-GICC)'], ['Bangalore', 'Bangalore (VP-Bangalore)']] },
          { label: 'Category', key: 'category', options: [['', 'All Categories'], ...['IT','HR','Finance','Admin','Operations','Marketing','Sales','Legal'].map(c => [c, c])] },
          { label: 'Team', key: 'team', options: [['', 'All Teams'], ['1T', '1T (First Touch)'], ['2T', '2T (Support)']] },
        ].map(({ label, key, options }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '10px', border: '1px solid var(--border)', minWidth: 'fit-content' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{label}</span>
            <select
              style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
              value={filters[key]}
              onChange={e => handleFilterChange(key, e.target.value)}
            >
              {options.map(([val, text]) => <option key={val} value={val}>{text}</option>)}
            </select>
          </div>
        ))}
      </div>

      {/* ── Views ── */}
      {viewMode === 'board' ? (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, 1fr)`, gap: '20px', minHeight: '60vh', alignItems: 'start' }}>
          {KANBAN_COLUMNS.map(col => (
            <div key={col.id}
              style={{ background: 'var(--surface-alt)', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: '200px', padding: '12px' }}
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={e => {
                e.preventDefault();
                const id  = e.dataTransfer.getData('ticketId') || e.dataTransfer.getData('text/plain');
                const cur = e.dataTransfer.getData('currentStatus');
                if (id?.trim()) handleStatusChange(id.trim(), col.id, cur);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '4px 8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.color }} />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{col.title}</h3>
                <span style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 800 }}>
                  {tickets.filter(t => t.status === col.id).length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {tickets.filter(t => t?._id && t.status === col.id).map(t => (
                  <div key={t._id} draggable
                    onDragStart={e => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', t._id);
                      e.dataTransfer.setData('ticketId', t._id);
                      e.dataTransfer.setData('currentStatus', t.status);
                      setTimeout(() => { e.target.style.opacity = '0.4'; }, 0);
                    }}
                    onDragEnd={e => { e.target.style.opacity = '1'; }}
                    onClick={() => navigate(`/tickets/${t._id}`)}
                    style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', cursor: 'grab', userSelect: 'none', transition: 'box-shadow 0.2s, transform 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px' }}>#{t.ticketId || t._id.slice(-6).toUpperCase()}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '12px', lineHeight: 1.4 }}>{t.title}</div>
                    <div className="flex-between">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--surface-alt)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.65rem' }}>{(t.createdBy?.name || 'U')[0]}</div>
                        {t.createdBy?.name?.split(' ')[0] || 'Unknown'}
                      </div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: t.priority === 'critical' ? 'var(--danger)' : 'var(--text-dim)', textTransform: 'capitalize' }}>{t.priority}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      ) : viewMode === 'list' ? (
        <div className="table-container" style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>Ticket ID <ArrowUpDown size={11} /></div></th>
                <th>Subject &amp; Reporter</th>
                <th style={{ width: '110px' }}>Category</th>
                <th className="col-center" style={{ width: '100px' }}>Priority</th>
                <th className="col-center" style={{ width: '110px' }}>Status</th>
                <th className="col-center" style={{ width: '90px' }}>SLA Score</th>
                <th style={{ width: '110px' }}>Last Activity</th>
                <th className="col-right" style={{ width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}><td colSpan="8"><div style={{ height: '52px', background: 'var(--surface-alt)', borderRadius: '8px', margin: '4px 0', animation: 'pulse 1.5s infinite' }} /></td></tr>
                  ))
                ) : tickets.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 'var(--s-16)', color: 'var(--text-dim)' }}>
                    <div className="flex-col flex-center gap-2">
                      <Search size={48} opacity={0.2} />
                      <p>No tickets found matching your criteria.</p>
                    </div>
                  </td></tr>
                ) : tickets.map((t, idx) => (
                  <React.Fragment key={t._id}>
                    <motion.tr
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => navigate(`/tickets/${t._id}`)}
                      className="dashboard-row"
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="ticket-id-tag">#{t.ticketId || t._id.slice(-6).toUpperCase()}</span>
                          {t.emailSource && <Mail size={14} style={{ color: 'var(--primary)' }} title="From Email" />}
                        </div>
                      </td>
                      <td style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--border)', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{t.createdBy?.name?.[0] || 'U'}</div>
                          <span>{t.createdBy?.name || 'Unknown'} &bull; {new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, padding: '3px 8px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: '6px', display: 'inline-block' }}>
                          {t.category || t.department}
                        </span>
                      </td>
                      <td className="col-center">
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '8px', background: t.priority === 'critical' ? '#FEF2F2' : t.priority === 'high' ? '#FFFBEB' : '#EFF6FF' }}>
                          <span className={`priority-indicator priority-${t.priority}`} style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 }} />
                          <span style={{ textTransform: 'capitalize', fontWeight: 700, fontSize: '0.8rem', color: t.priority === 'critical' ? '#991B1B' : t.priority === 'high' ? '#92400E' : '#1E40AF' }}>{t.priority}</span>
                        </div>
                      </td>
                      <td className="col-center">
                        <Badge variant={t.status === 'open' ? 'info' : t.status === 'resolved' ? 'success' : t.status === 'assigned' ? 'primary' : 'warning'}>
                          {t.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="col-center">
                        <div style={{ fontWeight: 900, fontSize: '0.9rem', color: t.slaScore >= 60 ? '#EF4444' : t.slaScore >= 35 ? '#F59E0B' : '#10B981', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          {t.slaScore || 0}
                          <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', opacity: 0.7 }}>PTS</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                          <Clock size={12} />{new Date(t.updatedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="col-right" style={{ position: 'relative' }}>
                        <button
                          className="row-action-btn"
                          onClick={e => { e.stopPropagation(); setActiveMenu(activeMenu === t._id ? null : t._id); }}
                        >
                          <MoreHorizontal size={20} strokeWidth={2.2} />
                        </button>
                        <AnimatePresence>
                          {activeMenu === t._id && (
                            <motion.div
                              key="dropdown"
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="dropdown-menu"
                              onClick={e => e.stopPropagation()}
                            >
                              <div className="menu-item" onClick={() => navigate(`/tickets/${t._id}`)}><Eye size={14} /> View Details</div>
                              {['admin', 'support_agent'].includes(user?.role) && t.status !== 'resolved' && (
                                <div className="menu-item" onClick={e => handleAction(t._id, 'resolve', e)}><CheckSquare size={14} /> Mark Resolved</div>
                              )}
                              {user?.role === 'admin' && (
                                <div className="menu-item danger" onClick={e => handleAction(t._id, 'delete', e)}><Trash2 size={14} /> Delete Ticket</div>
                              )}
                              <div className="menu-divider" />
                              <div className="menu-item disabled" style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                                Updated {new Date(t.updatedAt).toLocaleDateString()}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </td>
                    </motion.tr>
                  </React.Fragment>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

      ) : (
        /* Panel view */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          <AnimatePresence mode="popLayout">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ height: '200px', background: 'var(--surface-alt)', borderRadius: '20px', animation: 'pulse 1.5s infinite' }} />
              ))
            ) : tickets.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px', color: 'var(--text-dim)' }}>No tickets found.</div>
            ) : tickets.map((t, idx) => (
              <motion.div key={t._id}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.03 }}
                onClick={() => navigate(`/tickets/${t._id}`)}
                style={{ background: 'white', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}
                onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              >
                <div className="flex-between">
                  <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '0.75rem', background: 'var(--primary-light)', padding: '6px 12px', borderRadius: '10px' }}>#{t.ticketId || t._id.slice(-6).toUpperCase()}</span>
                  <Badge variant={t.status === 'open' ? 'info' : t.status === 'resolved' ? 'success' : 'primary'}>{t.status.replace('_', ' ')}</Badge>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-dark)', lineHeight: 1.3, marginBottom: '8px' }}>{t.title}</div>
                  <div className="flex-center gap-2" style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.7rem' }}>{t.createdBy?.name?.[0] || 'U'}</div>
                    <span style={{ fontWeight: 600 }}>{t.createdBy?.name || 'Unknown'}</span>
                    <span>•</span>
                    <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex-between" style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                  <div className="flex-center gap-2" style={{ padding: '6px 12px', borderRadius: '10px', background: t.priority === 'critical' ? '#FEF2F2' : '#F0F9FF' }}>
                    <span className={`priority-indicator priority-${t.priority}`} style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'capitalize', color: t.priority === 'critical' ? '#991B1B' : '#0369A1' }}>{t.priority}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t.category}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Confirm modal ── */}
      <Modal
        isOpen={confirmData.isOpen}
        onClose={() => setConfirmData(p => ({ ...p, isOpen: false }))}
        title="Confirm Status Change"
        footer={
          <div className="flex-center gap-3">
            <Button variant="ghost" onClick={() => setConfirmData(p => ({ ...p, isOpen: false }))}>Cancel</Button>
            <Button onClick={executeStatusChange}>Confirm</Button>
          </div>
        }
      >
        <p style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-main)' }}>{confirmData.message}</p>
      </Modal>

      {/* ── Pagination ── */}
      <div className="flex-between" style={{ padding: 'var(--s-4)', borderTop: '1px solid var(--border-light)', background: 'var(--surface-alt)' }}>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Page {pagination.page} of {pagination.totalPages}
        </div>
        <div className="flex-center gap-2">
          <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => handleFilterChange('page', pagination.page - 1)}>
            <ChevronLeft size={16} /> Previous
          </Button>
          <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => handleFilterChange('page', pagination.page + 1)}>
            Next <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      <style>{`
        .ticket-id-tag { font-weight: 800; color: var(--primary); font-size: 0.8rem; background: var(--primary-light); padding: 6px 10px; border-radius: 8px; }
        .row-action-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #94A3B8; background: transparent; border: none; transition: all 0.2s; cursor: pointer; }
        .row-action-btn:hover { background: #F1F5F9; color: var(--text-dark); }
        .dropdown-menu { position: absolute; right: 48px; top: -10px; z-index: 100; min-width: 170px; background: white; border: 1px solid var(--border); border-radius: 12px; padding: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
        .menu-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; font-size: 0.825rem; font-weight: 600; color: var(--text-main); border-radius: 8px; cursor: pointer; transition: all 0.2s; }
        .menu-item:hover { background: var(--primary-light); color: var(--primary); }
        .menu-item.danger:hover { background: #FEF2F2; color: #DC2626; }
        .menu-divider { height: 1px; background: #F1F5F9; margin: 6px 8px; }
        .menu-item.disabled { cursor: default; pointer-events: none; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </motion.div>
  );
}