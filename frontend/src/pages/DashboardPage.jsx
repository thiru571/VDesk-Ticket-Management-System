import React, { useState, useEffect } from "react";
import {
  Ticket, Clock, CheckCircle2, TrendingUp, MoreHorizontal, ArrowUpRight,
  AlertCircle, Activity, Star, Users, Shield, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { dashboardService, ticketService, userService } from "../services/ticketService";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { motion } from "framer-motion";
import { Button, Card, Badge } from "../ui";
import { timeAgo, getInitials, getAvatarColor } from "../utils/helpers";

const PRIORITY_COLORS = {
  critical: "var(--danger)",
  high: "var(--warning)",
  medium: "var(--primary)",
  low: "var(--success)",
};

const STATUS_COLOR = {
  open: "info",
  assigned: "primary",
  in_progress: "warning",
  on_hold: "warning",
  resolved: "success",
  closed: "success",
  reopened: "warning",
};

// ─── Profile Avatar (hero corner) ────────────────────────────────────────────
function HeroAvatar({ user, onClick }) {
  return (
    <div
      onClick={onClick}
      title="View Profile"
      style={{
        width: "48px", height: "48px", borderRadius: "50%",
        border: "2.5px solid rgba(255,255,255,0.7)",
        overflow: "hidden", cursor: "pointer", flexShrink: 0,
        background: user?.avatar ? "transparent" : getAvatarColor(user?.name),
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: "1rem", color: "#fff",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        transition: "transform 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.07)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.35)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.25)"; }}
    >
      {user?.avatar
        ? <img src={user.avatar} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : getInitials(user?.name)
      }
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isAgent = user?.role === "support_agent";
  const isAdminOrAgent = isAdmin || isAgent;

  const [stats, setStats] = useState(null);
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [agents, setAgents] = useState([]);
  const { on } = useSocket();

  // ── Socket listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const offTicketCreated = on("ticket_created", (data) => {
      if (data.ticket) {
        setRecentTickets((prev) => [data.ticket, ...prev].slice(0, 6));
        setStats((prev) => prev ? { ...prev, total: prev.total + 1, pending: prev.pending + 1 } : prev);
      }
    });
    const offStatusChanged = on("ticket_status_changed", (data) => {
      setRecentTickets((prev) =>
        prev.map((t) => t._id === data.ticketId?.toString() ? { ...t, status: data.status } : t)
      );
      if (data.status === "resolved") {
        setStats((prev) => prev ? { ...prev, resolved: prev.resolved + 1, pending: Math.max(0, prev.pending - 1) } : prev);
      }
    });
    const offAgentStatus = on("agent_status_updated", (data) => {
      setAgents((prev) =>
        prev.map((a) =>
          a._id === data.agentId?.toString()
            ? { ...a, liveStatus: data.status, lastStatusUpdate: data.timestamp, onSiteTicket: data.ticketDbId ? { ticketId: data.ticketId, _id: data.ticketDbId } : null }
            : a
        )
      );
    });
    return () => { offTicketCreated?.(); offStatusChanged?.(); offAgentStatus?.(); };
  }, [on]);

  // ── Fetch data ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        if (!isAdminOrAgent) {
          const res = await dashboardService.employee();
          const s = res.data.stats;
          setStats({
            total: s.total || 0,
            pending: (s.open || 0) + (s.assigned || 0) + (s.in_progress || 0),
            pendingFeedback: s.pendingFeedback || 0,
            resolved: s.resolved || 0,
            priorityBreakdown: s.priorityBreakdown || {},
            avgResolutionTime: s.avgResolutionHours || 0,
          });
          setRecentTickets(res.data.recentTickets || []);
          setLoading(false);
          return;
        }

        const [statsRes, ticketsRes] = await Promise.all([
          dashboardService.admin(),
          ticketService.getAll({ limit: 6, myTickets: isAgent ? "true" : undefined }),
        ]);
        const s = statsRes.data.stats;
        const trend = s.last7DaysTrend || { created: [], resolved: [] };
        const generatedChartData = Array.from({ length: 7 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split("T")[0];
          const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
          return {
            name: dayName,
            tickets: trend.created?.find((item) => item._id === dateStr)?.count || 0,
            resolved: trend.resolved?.find((item) => item._id === dateStr)?.count || 0,
          };
        });
        setChartData(generatedChartData);
        const totalCreatedThisWeek = generatedChartData.reduce((acc, c) => acc + c.tickets, 0);
        const totalResolvedThisWeek = generatedChartData.reduce((acc, c) => acc + c.resolved, 0);
        setStats({
          total: s.total || 0,
          pending: (s.open || 0) + (s.assigned || 0) + (s.in_progress || 0),
          pendingFeedback: s.pendingFeedback || 0,
          resolved: s.resolved || 0,
          avgResolutionTime: s.avgResolutionHours || 0,
          slaBreached: s.slaBreached || 0,
          priorityBreakdown: s.priorityBreakdown || {},
          slaAlerts: s.slaAlerts || [],
          trendCreated: totalCreatedThisWeek,
          trendResolved: totalResolvedThisWeek,
          pendingReassignRequests: s.pendingReassignRequests || 0,
          shiftStats: s.shiftStats || {},
          teamBreakdown: s.teamBreakdown || {},
        });
        setRecentTickets(ticketsRes.data.tickets || []);
        setLoading(false);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        setLoading(false);
      }
    };

    const fetchAgents = async () => {
      try { const res = await userService.getAgents(); setAgents(res.data.agents || []); } catch {}
    };

    fetchDashboardData();
    if (isAdmin) fetchAgents();
  }, [isAdminOrAgent, isAgent, isAdmin]);

  const priorityData = stats?.priorityBreakdown
    ? Object.entries(stats.priorityBreakdown).map(([k, v]) => ({ name: k, value: v }))
    : [{ name: "Critical", value: 2 }, { name: "High", value: 8 }, { name: "Medium", value: 15 }, { name: "Low", value: 6 }];

  const Spinner = () => (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "100%", padding: "80px" }}>
      <div className="button-spinner" style={{ width: "32px", height: "32px", borderColor: "var(--primary)", borderTopColor: "transparent" }} />
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  // EMPLOYEE DASHBOARD
  // ════════════════════════════════════════════════════════════════════════
  if (!isAdminOrAgent) {
    if (loading) return <Spinner />;
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout">

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #1E40AF 0%, #0F172A 100%)",
          padding: "var(--s-8)", borderRadius: "var(--r-xl)", color: "white",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 10px 30px -10px rgba(30,64,175,0.4)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: "var(--s-8)", flexWrap: "wrap", gap: "16px",
          position: "relative",
        }}>
          <div>
            <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "white" }}>
              How can we help, {user?.name?.split(" ")[0] ?? "there"}?
            </h1>
            <p style={{ opacity: 0.9 }}>Check the status of your requests or find answers in the knowledge base.</p>
          </div>
          {/* Profile Avatar — top right of hero */}
          <HeroAvatar user={user} onClick={() => navigate("/profile")} />
        </div>

        {/* Stat Cards */}
        <div className="dashboard-grid" style={{ marginBottom: "var(--s-8)" }}>
          {[
            { label: "Active Requests",      value: stats?.pending || 0,         icon: <Ticket size={24} />,       bg: "#EEF2FF", color: "var(--primary)" },
            { label: "Action Needed",        value: stats?.pendingFeedback || 0, icon: <Star size={24} />,         bg: "#FFFBEB", color: "var(--warning)", sub: "Resolved tickets waiting for your feedback." },
            { label: "Successfully Resolved",value: stats?.resolved || 0,        icon: <CheckCircle2 size={24} />, bg: "#ECFDF5", color: "var(--success)" },
          ].map((card, i) => (
            <div key={i} className="premium-stat-card" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>{card.label}</p>
                  <h2 style={{ fontSize: "1.75rem", fontWeight: 800 }}>{card.value}</h2>
                  {card.sub && <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", marginTop: "8px" }}>{card.sub}</p>}
                </div>
                <div style={{ background: card.bg, color: card.color, width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Tickets Table */}
        <Card style={{ border: "1px solid var(--border-light)", boxShadow: "var(--shadow-md)", borderRadius: "24px", overflow: "hidden" }}>
          <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 900, color: "var(--text-main)" }}>My Recent Requests</h2>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-dim)", fontWeight: 600 }}>Your latest support tickets</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/tickets")}>View All <ArrowUpRight size={16} /></Button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--surface-alt)" }}>
                  {["Ticket ID", "Subject", "Status", "Priority", "Date"].map(h => (
                    <th key={h} style={{ fontSize: "0.75rem", fontWeight: 900, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "1px", padding: "12px 16px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTickets.length > 0 ? recentTickets.map((t) => (
                  <tr key={t._id} onClick={() => navigate(`/tickets/${t._id}`)} style={{ borderBottom: "1px solid var(--border-light)", cursor: "pointer" }} className="premium-table-row">
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-dim)", background: "var(--border-light)", padding: "3px 9px", borderRadius: "6px" }}>#{t.ticketId}</span></td>
                    <td style={{ padding: "12px 16px", fontWeight: 700 }}>{t.title}</td>
                    <td style={{ padding: "12px 16px" }}><Badge variant={STATUS_COLOR[t.status] || "warning"}>{t.status?.replace(/_/g, " ")}</Badge></td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: PRIORITY_COLORS[t.priority?.toLowerCase()] }} />
                        <span style={{ fontSize: "0.85rem", fontWeight: 600, textTransform: "capitalize" }}>{t.priority}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: "0.8rem" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" style={{ textAlign: "center", padding: "60px", color: "var(--muted)" }}>No tickets yet. Create your first support request.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // ADMIN / AGENT DASHBOARD
  // ════════════════════════════════════════════════════════════════════════
  if (loading) return <Spinner />;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout">

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1E3A8A 0%, #020617 100%)",
        padding: "var(--s-8)", borderRadius: "var(--r-xl)", color: "white",
        border: "1px solid rgba(255,255,255,0.05)",
        boxShadow: "0 10px 30px -10px rgba(30,58,138,0.5)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "var(--s-8)", flexWrap: "wrap", gap: "16px",
      }}>
        <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 800, color: "white" }}>
            {isAgent ? `Ready for work, ${user?.name?.split(" ")[0] ?? "there"}?` : "Welcome back, Team!"}
          </h1>
          <p style={{ opacity: 0.85 }}>
            {isAgent ? "Here is a summary of your assigned tasks and performance today." : "Here's your support performance overview for today."}
          </p>
        </div>

        {/* Right side: Download Report + Profile Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button style={{
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "white", backdropFilter: "blur(10px)", padding: "10px 20px",
            borderRadius: "10px", cursor: "pointer", fontWeight: 600,
          }}>
            Download Report
          </button>
          {/* Profile Avatar */}
          <HeroAvatar user={user} onClick={() => navigate("/profile")} />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid-4" style={{ marginBottom: "var(--s-8)" }}>
        <div className="premium-stat-card" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>Total Tickets</p>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats?.total || 0}</h2>
            </div>
            <div style={{ background: "#EEF2FF", color: "var(--primary)", width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}><Ticket size={24} /></div>
          </div>
          <div style={{ marginTop: "16px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", color: "var(--success)", fontWeight: 600 }}>
            <ArrowUpRight size={14} /> <span>{stats?.trendCreated || 0} this week</span>
          </div>
        </div>

        <div className="premium-stat-card" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>Pending</p>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats?.pending || 0}</h2>
            </div>
            <div style={{ background: "#FFFBEB", color: "var(--warning)", width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}><Clock size={24} /></div>
          </div>
          <div style={{ marginTop: "16px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", color: "var(--text-dim)", fontWeight: 600 }}>
            <Activity size={14} /> <span>Active queue</span>
          </div>
        </div>

        <div className="premium-stat-card" style={{ border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>Resolved</p>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800 }}>{stats?.resolved || 0}</h2>
            </div>
            <div style={{ background: "#ECFDF5", color: "var(--success)", width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 size={24} /></div>
          </div>
          <div style={{ marginTop: "16px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", color: "var(--success)", fontWeight: 600 }}>
            <ArrowUpRight size={14} /> <span>{stats?.trendResolved || 0} this week</span>
          </div>
        </div>

        <div className="premium-stat-card" style={{ border: `1px solid ${stats?.slaBreached > 0 ? "#FCA5A5" : "var(--border)"}`, boxShadow: "var(--shadow-sm)", background: stats?.slaBreached > 0 ? "#FFF5F5" : "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>SLA Breached</p>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: stats?.slaBreached > 0 ? "var(--danger)" : "inherit" }}>{stats?.slaBreached || 0}</h2>
            </div>
            <div style={{ background: stats?.slaBreached > 0 ? "#FEF2F2" : "#F8FAFC", color: stats?.slaBreached > 0 ? "var(--danger)" : "var(--text-dim)", width: "48px", height: "48px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertCircle size={24} />
            </div>
          </div>
          <div style={{ marginTop: "16px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", color: stats?.slaBreached > 0 ? "var(--danger)" : "var(--success)", fontWeight: 600 }}>
            {stats?.slaBreached > 0
              ? <><AlertTriangle size={14} /> <span>Needs immediate attention</span></>
              : <><CheckCircle2 size={14} /> <span>All SLAs on track</span></>}
          </div>
        </div>
      </div>

      {/* Reassignment Requests Alert */}
      {isAdmin && stats?.pendingReassignRequests > 0 && (
        <div onClick={() => navigate("/tickets")} style={{ marginBottom: "var(--s-8)", padding: "16px 20px", borderRadius: "var(--r-lg)", background: "#FFFBEB", border: "2px dashed var(--warning)", cursor: "pointer", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ background: "white", color: "var(--warning)", width: "40px", height: "40px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--warning)" }}>
            <Shield size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: "#92400e" }}>{stats.pendingReassignRequests} Ticket Reassignment Requests Pending</div>
            <div style={{ fontSize: "0.82rem", color: "#b45309" }}>Agents are asking to transfer their workload. Action required from Admin.</div>
          </div>
          <Button size="sm" variant="warning">View Requests</Button>
        </div>
      )}

      {/* Main Grid */}
      <div className="premium-dashboard-grid">

        {/* LEFT */}
        <div className="flex-col" style={{ gap: "24px" }}>
          <div className="split-grid">
            {/* Line Chart */}
            <div className="premium-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ fontWeight: 800, fontSize: "1.1rem" }}>Weekly Resolution Trend</h3>
                <Badge variant="success">Completed</Badge>
              </div>
              <div style={{ height: "240px" }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "#94a3b8" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600, fill: "#94a3b8" }} dx={-10} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontWeight: 600 }} />
                    <Line type="monotone" dataKey="resolved" stroke="var(--success)" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: "white" }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="premium-card" style={{ marginBottom: 0 }}>
              <div style={{ marginBottom: "16px" }}><h3 style={{ fontWeight: 800, fontSize: "1.1rem" }}>Ticket Volume</h3></div>
              <div style={{ height: "260px" }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} dx={-10} />
                    <Tooltip cursor={{ fill: "var(--bg)" }} contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "var(--shadow-card)" }} />
                    <Bar dataKey="tickets" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Tickets Table */}
          <div className="premium-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontWeight: 800, fontSize: "1.1rem" }}>Recent Tickets</h3>
              <button className="premium-btn" style={{ padding: "6px 16px", fontSize: "0.8rem" }} onClick={() => navigate("/tickets")}>View All</button>
            </div>
            <div className="premium-table-wrapper">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Ticket ID</th><th>Subject</th><th>Priority</th><th>Status</th><th>Date</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentTickets.length > 0 ? recentTickets.map((t) => (
                    <tr key={t._id} onClick={() => navigate(`/tickets/${t._id}`)} className="dashboard-row" style={{ cursor: "pointer" }}>
                      <td><span className="ticket-id-tag">#{t.ticketId || t._id.slice(-6).toUpperCase()}</span></td>
                      <td>
                        <div style={{ fontWeight: 700, color: "var(--text-dark)" }}>{t.title}</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>by {t.createdBy?.name || "Unknown"}</div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span className={`priority-indicator priority-${t.priority}`} />
                          <span style={{ textTransform: "capitalize", fontWeight: 600, fontSize: "0.8rem" }}>{t.priority}</span>
                        </div>
                      </td>
                      <td><Badge variant={STATUS_COLOR[t.status] || "warning"}>{t.status?.replace(/_/g, " ")}</Badge></td>
                      <td style={{ color: "var(--text-dim)", fontSize: "0.8rem" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: "right" }}><button className="row-action-btn"><MoreHorizontal size={16} /></button></td>
                    </tr>
                  )) : (
                    <tr><td colSpan="6" style={{ textAlign: "center", padding: "32px", color: "var(--muted)" }}>No recent tickets available.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT Sidebar */}
        <div className="flex-col" style={{ gap: "24px" }}>

          {/* Priority Breakdown */}
          <div className="premium-card" style={{ marginBottom: 0 }}>
            <div style={{ marginBottom: "16px" }}><h3 style={{ fontWeight: 800, fontSize: "1.1rem" }}>Priority Breakdown</h3></div>
            <div style={{ height: "200px" }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={priorityData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name.toLowerCase()] || "var(--primary)"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "var(--shadow)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "16px" }}>
              {priorityData.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: PRIORITY_COLORS[p.name.toLowerCase()] || "var(--primary)" }} />
                    <span style={{ fontSize: "0.9rem", color: "var(--muted)", textTransform: "capitalize" }}>{p.name}</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{p.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Admin: Shift & Team Intelligence */}
          {isAdmin && (
            <div className="premium-card">
              <div style={{ marginBottom: "16px" }}><h3 style={{ fontWeight: 800, fontSize: "1.1rem" }}>Shift & Team Intelligence</h3></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                {[
                  { label: "1T Team (First Touch)", key: "1T", sub: "Active incidents" },
                  { label: "2T Team (Support)", key: "2T", sub: "Level 2 support" },
                ].map((team) => (
                  <div key={team.key} style={{ background: "var(--surface-alt)", padding: "16px", borderRadius: "16px", border: "1px solid var(--border)" }}>
                    <p style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", marginBottom: "8px" }}>{team.label}</p>
                    <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>{stats?.teamBreakdown?.[team.key] || 0}</div>
                    <p style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: "4px" }}>{team.sub}</p>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--text-main)", marginBottom: "12px" }}>Current Shift Performance</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {["morning", "mid", "night"].map((shift) => (
                  <div key={shift} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "var(--bg)", borderRadius: "10px" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "capitalize" }}>{shift} Shift</span>
                    <span style={{ fontWeight: 800, color: "var(--primary)" }}>{stats?.shiftStats?.[shift] || 0} Tickets</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLA Alerts */}
          <div className="premium-card" style={{ marginBottom: 0 }}>
            <div style={{ marginBottom: "16px" }}><h3 style={{ fontWeight: 800, fontSize: "1.1rem" }}>SLA Alerts</h3></div>
            {stats?.slaAlerts?.length > 0 ? stats.slaAlerts.map((alert) => (
              <div key={alert._id} className="premium-activity-item" style={{ cursor: "pointer" }} onClick={() => navigate(`/tickets/${alert._id}`)}>
                <div className="activity-icon" style={{ background: alert.sla?.breached ? "#fef2f2" : "#fffbeb", color: alert.sla?.breached ? "var(--danger)" : "var(--warning)" }}>
                  {alert.sla?.breached ? <AlertCircle size={16} /> : <Clock size={16} />}
                </div>
                <div className="activity-content">
                  <p><b>#{alert.ticketId}</b> {alert.sla?.breached ? "SLA Breached" : "Nearing Deadline"}</p>
                  <span style={{ display: "block", maxWidth: "200px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{alert.title}</span>
                </div>
              </div>
            )) : (
              <p style={{ fontSize: "0.875rem", color: "var(--muted)", textAlign: "center", padding: "20px" }}>No pending SLA alerts.</p>
            )}
          </div>

          {/* Admin: Live Agent Workload */}
          {isAdmin && (
            <Card style={{ marginBottom: 0, borderRadius: "24px", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)", padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "24px", borderBottom: "1px solid var(--border)", background: "var(--surface-alt)", display: "flex", alignItems: "center", gap: "12px" }}>
                <Users size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 900 }}>Live Agent Workload</h3>
              </div>
              <div style={{ padding: "8px" }}>
                {agents.length > 0 ? agents.map((agent) => (
                  <div key={agent._id} style={{ padding: "16px", borderRadius: "16px", borderBottom: "1px solid var(--bg)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ position: "relative" }}>
                        <div style={{ width: "40px", height: "40px", background: "#F1F5F9", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem" }}>
                          {agent.name[0]}
                        </div>
                        <div style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "12px", height: "12px", borderRadius: "50%", border: "2px solid white", background: { available: "#10B981", on_site: "#3B82F6", remote: "#F59E0B", unavailable: "#EF4444" }[agent.liveStatus || "available"] }} />
                      </div>
                      <div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 800, color: "var(--text-main)" }}>{agent.name}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-dim)", fontWeight: 600 }}>
                          {(agent.liveStatus || "available").replace("_", " ").toUpperCase()}
                          {agent.onSiteTicket && ` • #${agent.onSiteTicket.ticketId}`}
                        </div>
                      </div>
                    </div>
                    <div>
                      {agent.liveStatus === "on_site" ? (
                        <div style={{ textAlign: "right" }}>
                          <Badge variant="primary" style={{ fontSize: "0.65rem" }}>Active On-Site</Badge>
                          <div style={{ fontSize: "0.65rem", color: "var(--text-dim)", marginTop: "4px" }}>
                            {agent.onSiteTicket?.onSiteVisit?.arrivalConfirmedByEmployee ? "✅ Verified" : "⏳ Unverified"}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-dim)" }}>{agent.currentWorkload} active</span>
                      )}
                    </div>
                  </div>
                )) : (
                  <p style={{ textAlign: "center", padding: "20px", color: "var(--muted)", fontSize: "0.85rem" }}>No agents found.</p>
                )}
              </div>
              <div style={{ padding: "16px", background: "var(--bg)", textAlign: "center" }}>
                <Button variant="ghost" size="sm" onClick={() => navigate("/admin/users")} style={{ fontSize: "0.75rem" }}>Manage All Personnel</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </motion.div>
  );
}