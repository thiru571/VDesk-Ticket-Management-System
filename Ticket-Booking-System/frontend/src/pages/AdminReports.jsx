import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

// ── CSV Export Helper ────────────────────────────────────────────────────────
function exportToCSV(rows, filename) {
  const csvContent = rows
    .map(row =>
      row.map(cell => {
        const val = cell === undefined || cell === null ? '' : String(cell);
        return val.includes(',') || val.includes('"') || val.includes('\n')
          ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')
    ).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminReports() {
  const toast = useToast();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('agents');

  const [agentFilters, setAgentFilters] = useState({ name: '', email: '', resolved: '', rating: '' });
  const [catFilters,   setCatFilters]   = useState({ category: '', count: '' });
  const [agentSort,    setAgentSort]    = useState({ col: 'resolved', dir: 'desc' });
  const [catSort,      setCatSort]      = useState({ col: 'count',    dir: 'desc' });

  useEffect(() => {
    api.get('/dashboard/reports')
      .then(res => setData(res.data))
      .catch(() => toast.error('Failed to load reports'))
      .finally(() => setLoading(false));
  }, []);

  const filteredAgents = useMemo(() => {
    if (!data?.agentPerformance) return [];
    let rows = data.agentPerformance.filter(a => {
      return (
        (a.name  || '').toLowerCase().includes(agentFilters.name.toLowerCase()) &&
        (a.email || '').toLowerCase().includes(agentFilters.email.toLowerCase()) &&
        String(a.resolved || 0).includes(agentFilters.resolved) &&
        (a.avgRating ? a.avgRating.toFixed(1) : '').includes(agentFilters.rating)
      );
    });
    return [...rows].sort((a, b) => {
      let va = a[agentSort.col] ?? 0;
      let vb = b[agentSort.col] ?? 0;
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return agentSort.dir === 'asc' ? -1 : 1;
      if (va > vb) return agentSort.dir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [data, agentFilters, agentSort]);

  const filteredCats = useMemo(() => {
    if (!data?.topCategories) return [];
    let rows = data.topCategories.filter(c =>
      (c._id || 'Other').toLowerCase().includes(catFilters.category.toLowerCase()) &&
      String(c.count || 0).includes(catFilters.count)
    );
    return [...rows].sort((a, b) => {
      const ka = catSort.col === 'count' ? (a.count || 0) : (a._id || '').toLowerCase();
      const kb = catSort.col === 'count' ? (b.count || 0) : (b._id || '').toLowerCase();
      if (ka < kb) return catSort.dir === 'asc' ? -1 : 1;
      if (ka > kb) return catSort.dir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [data, catFilters, catSort]);

  const toggleSort = (col, sortState, setSortState) =>
    setSortState(prev => prev.col === col
      ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { col, dir: 'asc' });

  const SortIcon = ({ col, sortState }) => {
    if (sortState.col !== col) return <i className="fa-solid fa-sort" style={{ opacity: 0.3, fontSize: '0.7rem', marginLeft: '6px' }} />;
    return sortState.dir === 'asc'
      ? <i className="fa-solid fa-sort-up"   style={{ color: '#1F4E79', fontSize: '0.7rem', marginLeft: '6px' }} />
      : <i className="fa-solid fa-sort-down" style={{ color: '#1F4E79', fontSize: '0.7rem', marginLeft: '6px' }} />;
  };

  const handleExportAgents = () => {
    const date = new Date().toISOString().slice(0, 10);
    exportToCSV([
      ['Rank', 'Agent Name', 'Email', 'Tickets Resolved', 'Avg Rating'],
      ...filteredAgents.map((a, i) => [i + 1, a.name, a.email, a.resolved, a.avgRating ? a.avgRating.toFixed(1) : '—'])
    ], `agent-performance-${date}.csv`);
  };

  const handleExportCategories = () => {
    const date = new Date().toISOString().slice(0, 10);
    exportToCSV([
      ['Rank', 'Category', 'Ticket Count'],
      ...filteredCats.map((c, i) => [i + 1, c._id || 'Other', c.count])
    ], `issue-categories-${date}.csv`);
  };

  const handleExportAll = () => {
    const date = new Date().toISOString().slice(0, 10);
    exportToCSV([
      ['REPORT SUMMARY'], ['Metric', 'Value'],
      ['Avg Resolution Time (hrs)', data?.avgResolutionHours || 0],
      ['SLA Compliance Rate (%)',   data?.slaComplianceRate  || 100],
      ['Top Issue Type',            data?.topCategories?.[0]?._id || '—'],
      [],
      ['TOP ISSUE CATEGORIES'], ['Rank', 'Category', 'Ticket Count'],
      ...(data?.topCategories || []).map((c, i) => [i + 1, c._id || 'Other', c.count]),
      [],
      ['AGENT PERFORMANCE'], ['Rank', 'Agent Name', 'Email', 'Tickets Resolved', 'Avg Rating'],
      ...(data?.agentPerformance || []).map((a, i) => [i + 1, a.name, a.email, a.resolved, a.avgRating ? a.avgRating.toFixed(1) : '—']),
    ], `vdesk-full-report-${date}.csv`);
  };

  const filterInput = {
    width: '100%', padding: '5px 8px', fontSize: '0.78rem',
    border: '1px solid #E2E8F0', borderRadius: '6px',
    background: '#F8FAFC', color: 'var(--text)', outline: 'none', marginTop: '4px',
  };

  const thStyle = (extra = {}) => ({
    padding: '10px 14px', background: '#F1F5F9', fontWeight: 700,
    fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em',
    color: '#475569', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap',
    cursor: 'pointer', userSelect: 'none', ...extra,
  });

  const rankBadge = (i) => ({
    width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: '50%', fontSize: '0.72rem', fontWeight: 800,
    background: i === 0 ? '#F59E0B' : i === 1 ? '#94A3B8' : i === 2 ? '#CD7C2F' : '#F1F5F9',
    color: i < 3 ? 'white' : '#64748B',
  });

  const toolbarBtn = (primary = false) => ({
    padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '0.78rem', fontWeight: 700,
    border: primary ? 'none' : '1px solid #E2E8F0',
    background: primary ? '#1F4E79' : 'white',
    color: primary ? 'white' : '#64748B',
    display: 'flex', alignItems: 'center', gap: '6px',
  });

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }} />
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="page-layout">

      {/* Page Header */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800 }}>
            <i className="fa-solid fa-chart-bar" style={{ color: '#1F4E79', marginRight: '10px' }} />
            Reports
          </h1>
          <p style={{ color: 'var(--text-dim)' }}>Performance metrics and resolution summaries.</p>
        </div>
        <button onClick={handleExportAll} style={{ ...toolbarBtn(true), padding: '10px 20px', fontSize: '0.875rem' }}>
          <i className="fa-solid fa-download" />
          Export Full Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
        {[
          { label: 'Avg Resolution Time', value: `${data?.avgResolutionHours || 0} hrs`, icon: 'fa-clock',         color: '#1F4E79' },
          { label: 'SLA Compliance Rate', value: `${data?.slaComplianceRate  || 100}%`,  icon: 'fa-shield-halved', color: '#10B981' },
          { label: 'Top Issue Type',      value: data?.topCategories?.[0]?._id || '—',   icon: 'fa-tag',           color: '#F59E0B' },
        ].map(card => (
          <div key={card.label} style={{ background: 'white', borderRadius: '16px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>{card.label}</span>
              <i className={`fa-solid ${card.icon}`} style={{ color: card.color, fontSize: '1.1rem' }} />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '2px solid #E2E8F0' }}>
        {[
          { id: 'agents',     label: 'Agent Performance', icon: 'fa-ranking-star' },
          { id: 'categories', label: 'Issue Categories',  icon: 'fa-fire' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: 700,
            fontSize: '0.85rem', background: 'transparent',
            color: activeTab === tab.id ? '#1F4E79' : 'var(--text-dim)',
            borderBottom: activeTab === tab.id ? '2px solid #1F4E79' : '2px solid transparent',
            marginBottom: '-2px', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <i className={`fa-solid ${tab.icon}`} />{tab.label}
          </button>
        ))}
      </div>

      {/* Agent Performance Table */}
      {activeTab === 'agents' && (
        <motion.div key="agents" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ background: 'white', borderRadius: '0 0 16px 16px', border: '1px solid #E2E8F0', borderTop: 'none', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', background: '#FAFBFC' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} shown
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setAgentFilters({ name: '', email: '', resolved: '', rating: '' })} style={toolbarBtn()}>
                  <i className="fa-solid fa-xmark" /> Clear Filters
                </button>
                <button onClick={handleExportAgents} style={toolbarBtn(true)}>
                  <i className="fa-solid fa-download" /> Export CSV
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={thStyle({ width: '60px', textAlign: 'center' })}>#</th>
                    <th style={thStyle()} onClick={() => toggleSort('name', agentSort, setAgentSort)}>
                      Agent <SortIcon col="name" sortState={agentSort} />
                    </th>
                    <th style={thStyle()} onClick={() => toggleSort('email', agentSort, setAgentSort)}>
                      Email <SortIcon col="email" sortState={agentSort} />
                    </th>
                    <th style={thStyle({ textAlign: 'center', width: '150px' })} onClick={() => toggleSort('resolved', agentSort, setAgentSort)}>
                      Tickets Resolved <SortIcon col="resolved" sortState={agentSort} />
                    </th>
                    <th style={thStyle({ textAlign: 'center', width: '120px' })} onClick={() => toggleSort('avgRating', agentSort, setAgentSort)}>
                      Avg Rating <SortIcon col="avgRating" sortState={agentSort} />
                    </th>
                  </tr>
                  {/* Filter row */}
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '6px 14px' }} />
                    <td style={{ padding: '6px 14px' }}>
                      <input placeholder="Filter name..." value={agentFilters.name}
                        onChange={e => setAgentFilters(f => ({ ...f, name: e.target.value }))} style={filterInput} />
                    </td>
                    <td style={{ padding: '6px 14px' }}>
                      <input placeholder="Filter email..." value={agentFilters.email}
                        onChange={e => setAgentFilters(f => ({ ...f, email: e.target.value }))} style={filterInput} />
                    </td>
                    <td style={{ padding: '6px 14px' }}>
                      <input placeholder="e.g. 10" value={agentFilters.resolved}
                        onChange={e => setAgentFilters(f => ({ ...f, resolved: e.target.value }))}
                        style={{ ...filterInput, textAlign: 'center' }} />
                    </td>
                    <td style={{ padding: '6px 14px' }}>
                      <input placeholder="e.g. 4.5" value={agentFilters.rating}
                        onChange={e => setAgentFilters(f => ({ ...f, rating: e.target.value }))}
                        style={{ ...filterInput, textAlign: 'center' }} />
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {filteredAgents.length === 0 ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
                      <i className="fa-solid fa-inbox" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block', opacity: 0.4 }} />
                      No agents match the current filters.
                    </td></tr>
                  ) : filteredAgents.map((a, i) => (
                    <tr key={a._id} style={{ borderBottom: '1px solid #F1F5F9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        <span style={rankBadge(i)}>{i + 1}</span>
                      </td>
                      <td style={{ padding: '14px', fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EFF6FF', color: '#1F4E79', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.72rem', flexShrink: 0 }}>
                            {(a.name || 'A').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          {a.name}
                        </div>
                      </td>
                      <td style={{ padding: '14px', color: 'var(--text-dim)', fontSize: '0.82rem' }}>{a.email}</td>
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        <span style={{ background: '#EFF6FF', color: '#1F4E79', padding: '4px 12px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 700 }}>
                          {a.resolved}
                        </span>
                      </td>
                      <td style={{ padding: '14px', textAlign: 'center' }}>
                        {a.avgRating
                          ? <span style={{ color: '#F59E0B', fontWeight: 700 }}><i className="fa-solid fa-star" style={{ marginRight: '4px', fontSize: '0.8rem' }} />{a.avgRating.toFixed(1)}</span>
                          : <span style={{ color: 'var(--text-dim)' }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Issue Categories Table */}
      {activeTab === 'categories' && (
        <motion.div key="categories" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ background: 'white', borderRadius: '0 0 16px 16px', border: '1px solid #E2E8F0', borderTop: 'none', overflow: 'hidden' }}>
            {/* Toolbar */}
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', background: '#FAFBFC' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', fontWeight: 600 }}>
                {filteredCats.length} categor{filteredCats.length !== 1 ? 'ies' : 'y'} shown
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setCatFilters({ category: '', count: '' })} style={toolbarBtn()}>
                  <i className="fa-solid fa-xmark" /> Clear Filters
                </button>
                <button onClick={handleExportCategories} style={toolbarBtn(true)}>
                  <i className="fa-solid fa-download" /> Export CSV
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    <th style={thStyle({ width: '60px', textAlign: 'center' })}>#</th>
                    <th style={thStyle()} onClick={() => toggleSort('_id', catSort, setCatSort)}>
                      Category <SortIcon col="_id" sortState={catSort} />
                    </th>
                    <th style={thStyle({ textAlign: 'center', width: '160px' })} onClick={() => toggleSort('count', catSort, setCatSort)}>
                      Ticket Count <SortIcon col="count" sortState={catSort} />
                    </th>
                    <th style={thStyle({ width: '220px' })}>Volume</th>
                  </tr>
                  {/* Filter row */}
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <td style={{ padding: '6px 14px' }} />
                    <td style={{ padding: '6px 14px' }}>
                      <input placeholder="Filter category..." value={catFilters.category}
                        onChange={e => setCatFilters(f => ({ ...f, category: e.target.value }))} style={filterInput} />
                    </td>
                    <td style={{ padding: '6px 14px' }}>
                      <input placeholder="e.g. 20" value={catFilters.count}
                        onChange={e => setCatFilters(f => ({ ...f, count: e.target.value }))}
                        style={{ ...filterInput, textAlign: 'center' }} />
                    </td>
                    <td style={{ padding: '6px 14px' }} />
                  </tr>
                </thead>
                <tbody>
                  {filteredCats.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-dim)' }}>
                      <i className="fa-solid fa-inbox" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block', opacity: 0.4 }} />
                      No categories match the current filters.
                    </td></tr>
                  ) : (() => {
                    const maxCount = Math.max(...filteredCats.map(c => c.count || 0), 1);
                    return filteredCats.map((c, i) => (
                      <tr key={c._id} style={{ borderBottom: '1px solid #F1F5F9' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                        <td style={{ padding: '14px', textAlign: 'center' }}>
                          <span style={rankBadge(i)}>{i + 1}</span>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <span style={{ background: '#FFF7ED', color: '#92400E', padding: '4px 10px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 700 }}>
                            {c._id || 'Other'}
                          </span>
                        </td>
                        <td style={{ padding: '14px', textAlign: 'center', fontWeight: 700, color: '#1F4E79' }}>{c.count}</td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ background: '#F1F5F9', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', borderRadius: '4px', background: '#1F4E79', width: `${Math.round((c.count / maxCount) * 100)}%`, transition: 'width 0.4s ease' }} />
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}