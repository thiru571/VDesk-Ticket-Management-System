import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { notificationService } from "../services/ticketService";
import {
  Bell,
  CheckCheck,
  BellOff,
  Search,
  RefreshCw,
  Settings,
  CheckCircle,
  UserCheck,
  Archive,
  AlertTriangle
} from 'lucide-react';

// ─── Icon + colour per notification type ────────────────────────────────────
const TYPE_META = {
  system: {
    icon: <Settings size={18} />,
    accent: "#185FA5",
    bg: "#E6F1FB",
  },
  resolved: {
    icon: <CheckCircle size={18} />,
    accent: "#3B6D11",
    bg: "#EAF3DE",
  },
  progress: {
     icon: <RefreshCw size={18} />,
    accent: "#854F0B",
    bg: "#FAEEDA",
  },
  assigned: {
    icon: <UserCheck size={18} />,
    accent: "#534AB7",
    bg: "#EEEDFE",
  },
  archived: {
    icon: <Archive size={18} />,
    accent: "#5F5E5A",
    bg: "#F1EFE8",
  },
  warning: {
    icon: <AlertTriangle size={18} />,
    accent: "#A32D2D",
    bg: "#FCEBEB",
  },
  default: {
    icon: <Bell size={18} />,
    accent: "#185FA5",
    bg: "#E6F1FB",
  },
};

function inferType(notification) {
  const title = (notification.title || "").toLowerCase();
  if (
    title.includes("system") ||
    title.includes("asset") ||
    title.includes("update")
  )
    return "system";
  if (title.includes("resolved")) return "resolved";
  if (title.includes("progress") || title.includes("escalat"))
    return "progress";
  if (title.includes("assigned")) return "assigned";
  if (title.includes("archived")) return "archived";
  if (
    title.includes("sla") ||
    title.includes("breach") ||
    title.includes("warning")
  )
    return "warning";
  return "default";
}

function groupByDate(notifications) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - 6);

  const groups = { Today: [], "Earlier this week": [], Older: [] };
  notifications.forEach((n) => {
    const d = new Date(n.createdAt);
    if (d >= today) groups["Today"].push(n);
    else if (d >= weekStart) groups["Earlier this week"].push(n);
    else groups["Older"].push(n);
  });
  return groups;
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = {
  page: {
    padding: "28px 24px",
    maxWidth: 780,
    margin: "0 auto",
    fontFamily: "inherit",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  titleRow: { display: "flex", alignItems: "center", gap: 10 },
  pageTitle: { fontSize: 20, fontWeight: 600, color: "#111827", margin: 0 },
  countBadge: {
    background: "#185FA5",
    color: "#fff",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    padding: "2px 8px",
  },
  btnGhost: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "none",
    border: "1px solid #E5E7EB",
    borderRadius: 8,
    padding: "7px 14px",
    fontSize: 13,
    fontWeight: 500,
    color: "#374151",
    cursor: "pointer",
  },
  searchWrap: { position: "relative", marginBottom: 16 },
  searchIcon: {
    position: "absolute",
    left: 12,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9CA3AF",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "10px 12px 10px 38px",
    fontSize: 14,
    border: "1px solid #E5E7EB",
    borderRadius: 10,
    background: "#fff",
    color: "#111827",
    outline: "none",
    boxSizing: "border-box",
  },
  filterRow: { display: "flex", gap: 6, marginBottom: 22, flexWrap: "wrap" },
  pill: (active) => ({
    padding: "5px 14px",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    border: "1px solid",
    borderColor: active ? "transparent" : "#E5E7EB",
    borderRadius: 20,
    cursor: "pointer",
    background: active ? "#185FA5" : "#fff",
    color: active ? "#fff" : "#6B7280",
  }),
  groupLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "#9CA3AF",
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    padding: "4px 0 10px",
    marginTop: 8,
  },
  list: {
    border: "1px solid #E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
    background: "#fff",
    marginBottom: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  item: (unread) => ({
    display: "flex",
    gap: 14,
    padding: "16px 18px",
    borderBottom: "1px solid #F3F4F6",
    cursor: "pointer",
    background: unread ? "#F0F6FF" : "#fff",
    borderLeft: `3px solid ${unread ? "#185FA5" : "transparent"}`,
    transition: "background 0.15s",
  }),
  iconWrap: (bg) => ({
    width: 38,
    height: 38,
    borderRadius: "50%",
    background: bg,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 17,
    flexShrink: 0,
    marginTop: 2,
  }),
  body: { flex: 1, minWidth: 0 },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 3,
  },
  nTitle: (unread) => ({
    fontSize: 14,
    fontWeight: unread ? 700 : 500,
    color: "#111827",
    lineHeight: 1.4,
  }),
  badge: (unread) => ({
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 8px",
    borderRadius: 20,
    flexShrink: 0,
    background: unread ? "#DBEAFE" : "#F3F4F6",
    color: unread ? "#1D4ED8" : "#6B7280",
    letterSpacing: "0.04em",
  }),
  msg: { fontSize: 13, color: "#4B5563", lineHeight: 1.55, marginBottom: 8 },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  time: { fontSize: 11, color: "#9CA3AF" },
  actBtns: { display: "flex", gap: 6 },
  btnPrimary: {
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 600,
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    background: "#1F4E79",
    color: "#fff",
  },
  btnDismiss: {
    padding: "4px 12px",
    fontSize: 12,
    fontWeight: 500,
    border: "1px solid #E5E7EB",
    borderRadius: 6,
    cursor: "pointer",
    background: "#fff",
    color: "#6B7280",
  },
  center: {
    padding: "48px 24px",
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
  },
  errorBox: {
    padding: "12px 16px",
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    borderRadius: 8,
    color: "#B91C1C",
    fontSize: 13,
    marginBottom: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
};

const FILTERS = ["All", "Unread", "Tickets", "System"];

// ─── Component ───────────────────────────────────────────────────────────────
export default function NotificationPage() {
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [dismissing, setDismissing] = useState(new Set());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    notificationService
      .getAll({ limit: 50 })
      .then((res) => setNotifications(res.data.notifications || []))
      .catch(() => setError("Failed to load notifications. Please try again."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived list ─────────────────────────────────────────────────────────
  const filtered = notifications.filter((n) => {
    if (activeFilter === "Unread" && n.isRead) return false;
    if (activeFilter === "Tickets" && inferType(n) === "system") return false;
    if (activeFilter === "System" && inferType(n) !== "system") return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !(n.title || "").toLowerCase().includes(q) &&
        !(n.message || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const groups = groupByDate(filtered);

  // ── Actions ──────────────────────────────────────────────────────────────
  const markRead = (notification) => {
    if (notification.isRead) return;
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === notification._id ? { ...n, isRead: true } : n,
      ),
    );
    notificationService.markRead({ ids: [notification._id] }).catch(() => {
      // revert on failure
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === notification._id ? { ...n, isRead: false } : n,
        ),
      );
    });
  };

  const markAllRead = () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n._id);
    if (!unreadIds.length) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    notificationService.markRead({ ids: unreadIds }).catch(() => load());
  };

  const dismiss = (e, id) => {
    e.stopPropagation();
    setDismissing((prev) => new Set(prev).add(id));
    notificationService
      .delete(id)
      .then(() => setNotifications((prev) => prev.filter((n) => n._id !== id)))
      .catch(() => setError("Could not dismiss notification."))
      .finally(() =>
        setDismissing((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        }),
      );
  };

  const handleClick = (notification) => {
    markRead(notification);
    const dest =
      notification.link ||
      (notification.ticket ? `/tickets/${notification.ticket}` : null);
    if (dest) navigate(dest);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderItem = (n) => {
    const type = inferType(n);
    const meta = TYPE_META[type] || TYPE_META.default;
    const unread = !n.isRead;
    const isSystemType = type === "system";

    return (
      <div
        key={n._id}
        style={s.item(unread)}
        onClick={() => handleClick(n)}
        onMouseEnter={(e) => {
          if (!unread) e.currentTarget.style.background = "#F9FAFB";
        }}
        onMouseLeave={(e) => {
          if (!unread) e.currentTarget.style.background = "#fff";
        }}
      >
        <div style={s.iconWrap(meta.bg)}>{meta.icon}</div>

        <div style={s.body}>
          <div style={s.topRow}>
            <span style={s.nTitle(unread)}>{n.title}</span>
            <span style={s.badge(unread)}>{unread ? "UNSEEN" : "SEEN"}</span>
          </div>

          <p style={s.msg}>{n.message}</p>

          <div style={s.footer}>
            <span style={s.time}>
              {n.createdAt
                ? new Date(n.createdAt).toLocaleString()
                : "Just now"}
            </span>
            <div style={s.actBtns}>
              {isSystemType && !n.isRead && (
                <button
                  style={s.btnPrimary}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick(n);
                  }}
                >
                  View changes
                </button>
              )}
              <button
                style={{
                  ...s.btnDismiss,
                  opacity: dismissing.has(n._id) ? 0.5 : 1,
                }}
                onClick={(e) => dismiss(e, n._id)}
                disabled={dismissing.has(n._id)}
              >
                {dismissing.has(n._id) ? "…" : "Dismiss"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (label, items) => {
    if (!items.length) return null;
    return (
      <div key={label}>
        <p style={s.groupLabel}>{label}</p>
        <div style={s.list}>{items.map(renderItem)}</div>
      </div>
    );
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.titleRow}>
          <Bell size={22} color="#111827" />
          <h2 style={s.pageTitle}>Notifications</h2>
          {unreadCount > 0 && <span style={s.countBadge}>{unreadCount}</span>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.btnGhost} onClick={load} title="Refresh">
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            style={s.btnGhost}
            onClick={markAllRead}
            disabled={!unreadCount}
          >
            <CheckCheck size={14} /> Mark all as read
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div style={s.errorBox}>
          <span>{error}</span>
          <button
            style={{ ...s.btnDismiss, fontSize: 11 }}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search */}
      <div style={s.searchWrap}>
        <Search size={15} style={s.searchIcon} />
        <input
          style={s.searchInput}
          type="text"
          placeholder="Search notifications..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div style={s.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f}
            style={s.pill(activeFilter === f)}
            onClick={() => setActiveFilter(f)}
          >
            {f}
            {f === "Unread" && unreadCount > 0 && (
              <span
                style={{
                  marginLeft: 5,
                  background:
                    activeFilter === "Unread"
                      ? "rgba(255,255,255,0.3)"
                      : "#185FA5",
                  color: activeFilter === "Unread" ? "#fff" : "#fff",
                  borderRadius: 20,
                  fontSize: 10,
                  padding: "1px 5px",
                  fontWeight: 700,
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={s.center}>Loading notifications…</div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            ...s.center,
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <BellOff size={32} style={{ marginBottom: 10, color: "#D1D5DB" }} />
         <p>
  {search || activeFilter !== 'All'
    ? 'No notifications match your filter.'
    : "You're all caught up!"}
</p>
        </div>
      ) : (
        <>
          {renderGroup("Today", groups["Today"])}
          {renderGroup("Earlier this week", groups["Earlier this week"])}
          {renderGroup("Older", groups["Older"])}
        </>
      )}
    </div>
  );
}
