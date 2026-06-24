import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import api from "../services/api";

const EVENT_COLORS = {
  OTP_SUCCESS: "bg-green-100 text-green-700",
  OTP_FAILED: "bg-red-100 text-red-700",
  OTP_SENT: "bg-yellow-100 text-yellow-700",
  TICKET_CREATED: "bg-blue-100 text-blue-700",
  TICKET_ASSIGNED: "bg-indigo-100 text-indigo-700",
  STATUS_CHANGED: "bg-purple-100 text-purple-700",
  PRIORITY_CHANGED: "bg-orange-100 text-orange-700",
  TICKET_DELETED: "bg-red-100 text-red-700",
};

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState("ALL");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await api.get("/auditlogs");
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const searchMatch =
        log.email.toLowerCase().includes(search.toLowerCase()) ||
        log.event.toLowerCase().includes(search.toLowerCase());

      const eventMatch =
        eventFilter === "ALL" || log.event === eventFilter;

      return searchMatch && eventMatch;
    });
  }, [logs, search, eventFilter]);

  const totalLogs = logs.length;
  const loginLogs = logs.filter((l) => l.event.includes("OTP")).length;
  const ticketLogs = logs.filter((l) => l.event.includes("TICKET")).length;

  const todayLogs = logs.filter(
    (l) =>
      new Date(l.createdAt).toDateString() ===
      new Date().toDateString()
  ).length;

  return (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    className="page-layout"
  >
    {/* Header */}
    <div
      style={{
        background: "linear-gradient(135deg,#1F4E79,#2563EB)",
        borderRadius: "20px",
        padding: "30px",
        color: "white",
        marginBottom: "28px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              marginBottom: "8px",
            }}
          >
            🔐 Audit Logs
          </h1>

          <p style={{ color: "#DBEAFE" }}>
            Monitor every login, ticket update and administrator action.
          </p>
        </div>

        <div style={{ fontSize: "55px" }}>
          <i className="fa-solid fa-shield-halved"></i>
        </div>
      </div>
    </div>

    {/* KPI Cards */}

    <div className="dashboard-grid-4" style={{ marginBottom: "28px" }}>

      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p style={{ color: "gray", fontWeight: 600 }}>Total Logs</p>
        <h2 style={{ fontSize: "2rem", fontWeight: 800 }}>
          {totalLogs}
        </h2>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p style={{ color: "gray", fontWeight: 600 }}>Login Events</p>

        <h2
          style={{
            color: "#16A34A",
            fontSize: "2rem",
            fontWeight: 800,
          }}
        >
          {loginLogs}
        </h2>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p style={{ color: "gray", fontWeight: 600 }}>
          Ticket Events
        </p>

        <h2
          style={{
            color: "#2563EB",
            fontSize: "2rem",
            fontWeight: 800,
          }}
        >
          {ticketLogs}
        </h2>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <p style={{ color: "gray", fontWeight: 600 }}>
          Today's Logs
        </p>

        <h2
          style={{
            color: "#EA580C",
            fontSize: "2rem",
            fontWeight: 800,
          }}
        >
          {todayLogs}
        </h2>
      </div>

    </div>

    {/* Search */}

    <div style={{ marginBottom: "16px" }}>
    <h3
        style={{
            fontWeight: 700,
            fontSize: "16px",
            color: "#1F4E79"
        }}
    >
        Filter Audit Logs
    </h3>

    <p
        style={{
            color: "var(--text-dim)",
            fontSize: "13px"
        }}
    >
        Search and filter audit events.
    </p>
</div>

    <div
      style={{
         background: "white",
         borderRadius: "16px",
         padding: "20px",
         marginBottom: "24px",
         border: "1px solid var(--border)",
         boxShadow: "var(--shadow-sm)"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <input
  type="text"
  placeholder="🔍 Search by email or event..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  style={{
    flex: 1,
    height: "46px",
    padding: "0 16px",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    background: "#F8FAFC",
    color: "var(--text)",
    fontSize: "14px",
    outline: "none",
    transition: "0.2s ease"
  }}
/>

<select
  value={eventFilter}
  onChange={(e) => setEventFilter(e.target.value)}
  style={{
    width: "220px",
    height: "46px",
    padding: "0 14px",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    background: "#F8FAFC",
    color: "var(--text)",
    fontSize: "14px",
    cursor: "pointer",
    outline: "none"
  }}
>
          <option value="ALL">All Events</option>

          <option value="OTP_SUCCESS">OTP_SUCCESS</option>

          <option value="OTP_FAILED">OTP_FAILED</option>

          <option value="OTP_SENT">OTP_SENT</option>

          <option value="TICKET_CREATED">
            TICKET_CREATED
          </option>

          <option value="TICKET_ASSIGNED">
            TICKET_ASSIGNED
          </option>

          <option value="STATUS_CHANGED">
            STATUS_CHANGED
          </option>

          <option value="PRIORITY_CHANGED">
            PRIORITY_CHANGED
          </option>

          <option value="TICKET_DELETED">
            TICKET_DELETED
          </option>

        </select>
      </div>
    </div>
    

        {/* Audit Log Table */}

    {loading ? (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <div className="spinner-primary"></div>
      </div>
    ) : (
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          boxShadow: "var(--shadow-sm)",
          overflow: "hidden",
        }}
      >
        <table className="ent-table">
          <thead>
            <tr>
              <th>Event</th>
              <th>Email</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td
                  colSpan="3"
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#64748B",
                  }}
                >
                  No audit logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log._id}>
                  <td>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        EVENT_COLORS[log.event] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {log.event.replaceAll("_", " ")}
                    </span>
                  </td>

                  <td>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                        }}
                      >
                        {log.email}
                      </span>

                      <span
                        style={{
                          fontSize: "12px",
                          color: "#64748B",
                        }}
                      >
                        {log.ip || "Unknown IP"}
                      </span>
                    </div>
                  </td>

                  <td>
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    )}

      </motion.div>
);
}