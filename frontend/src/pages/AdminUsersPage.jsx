import { useState, useEffect, useRef } from "react";
import { useSocket } from "../context/SocketContext";
import {
  Users,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  UserPlus,
  Upload,
  Download,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import { useToast } from "../context/ToastContext";
import { userService } from "../services/ticketService";
import { getInitials, getAvatarColor, timeAgo } from "../utils/helpers";
import { Card, Button, Input, Badge, Modal } from "../ui";
import { motion, AnimatePresence } from "framer-motion";
import api from "../services/api";

const ROLES = ["employee", "support_agent", "admin"];
const DEPARTMENTS = [
  "IT",
  "HR",
  "Finance",
  "Admin",
  "Operations",
  "Marketing",
  "Sales",
  "Legal",
];
const PAGE_LIMIT = 20;

const ROLE_CONFIG = {
  admin: { label: "Admin", bg: "#FEE2E2", color: "#991B1B", dot: "#EF4444" },
  support_agent: {
    label: "Support Agent",
    bg: "#DBEAFE",
    color: "#1E40AF",
    dot: "#3B82F6",
  },
  employee: {
    label: "Employee",
    bg: "#F3F4F6",
    color: "#374151",
    dot: "#9CA3AF",
  },
};

const STATUS_CONFIG = {
  verified: {
    bg: "#D1FAE5",
    color: "#065F46",
    dot: "#10B981",
    label: "Verified",
  },
  pending: {
    bg: "#FEF3C7",
    color: "#92400E",
    dot: "#F59E0B",
    label: "Pending",
  },
  active: { bg: "#EFF6FF", color: "#1D4ED8", dot: "#3B82F6", label: "Active" },
  inactive: {
    bg: "#F3F4F6",
    color: "#6B7280",
    dot: "#9CA3AF",
    label: "Inactive",
  },
};

function RolePill({ role }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.employee;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "999px",
        background: cfg.bg,
        color: cfg.color,
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

function StatusPill({ label, type }) {
  const cfg = STATUS_CONFIG[type] || STATUS_CONFIG.inactive;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "999px",
        background: cfg.bg,
        color: cfg.color,
        fontSize: "11px",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
        }}
      />
      {cfg.label}
    </span>
  );
}

function WorkloadBar({ user }) {
  if (user.role !== "support_agent") {
    return <span style={{ color: "#9CA3AF", fontSize: "12px" }}>—</span>;
  }
  const load = user.currentWorkload || 0;
  const max = 20;
  const pct = Math.min((load / max) * 100, 100);
  const isCritical = pct >= 85;
  const isHigh = pct >= 60;
  const barColor = isCritical ? "#EF4444" : isHigh ? "#F59E0B" : "#3B82F6";
  const label = isCritical
    ? "Critical"
    : isHigh
      ? "High Load"
      : `${Math.round(pct)}%`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        minWidth: "80px",
      }}
    >
      <div
        style={{
          height: "5px",
          background: "#F3F4F6",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: barColor,
            borderRadius: "999px",
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          color: barColor,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Avatar({ name, size = 36 }) {
  const bg = getAvatarColor(name);
  const initials = getInitials(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: size * 0.33,
        flexShrink: 0,
        letterSpacing: "0.02em",
      }}
    >
      {initials}
    </div>
  );
}

export default function AdminUsersPage() {
  const toast = useToast();
  const { on } = useSocket();
  const fileInputRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
  name: '',
  email: '',
  password: '',

  role: 'employee',
  department: 'IT',
  designation: '',

  employeeId: '',
  phone: '',

  preferredContact: 'email',

  location: {
    address1: '',
    address2: '',
    city: '',
    district: '',
    state: '',
    pincode: ''
  }
});
  const [createdPassword, setCreatedPassword] = useState(null);
  const [creating, setCreating] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [importing, setImporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewMode, setViewMode] = useState(
    localStorage.getItem("userViewMode") || "list",
  );
  const [roleConfirm, setRoleConfirm] = useState({
    isOpen: false,
    userId: null,
    newRole: null,
    userName: "",
  });

  const allSelected =
    users.length > 0 && users.every((u) => selectedIds.includes(u._id));
  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : users.map((u) => u._id));
  const toggleOne = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);
  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, page]);

  useEffect(() => {
    if (!on) return;
    const off = on("user_updated", (data) => {
      setUsers((prev) =>
        prev.map((u) => (u._id === data.user._id ? data.user : u)),
      );
    });
    return () => off && off();
  }, [on]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get("/users", {
        params: { search, role: roleFilter, page, limit: PAGE_LIMIT },
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#!";
    return Array.from(
      { length: 12 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join("");
  };

  const handleCreate = async () => {
    if (!createForm.email || !createForm.name)
      return toast.error("Email and name are required");
    const password = createForm.password || generatePassword();
    setCreating(true);
    try {
      await api.post("/auth/admin/create-user", { ...createForm, password });
      setCreatedPassword(password);
      setCreateForm({
        email: "",
        name: "",
        role: "employee",
        department: "IT",
        designation: "",
        password: "",
      });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPassword || resetPassword.length < 8)
      return toast.error("Password must be at least 8 characters");
    setResetting(true);
    try {
      await api.put("/auth/admin/reset-password", {
        userId: selectedUser._id,
        newPassword: resetPassword,
      });
      toast.success("Password updated.");
      setIsResetModalOpen(false);
      setResetPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  const openEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      role: user.role,
      department: user.department,
      designation: user.designation || "",
      isActive: user.isActive,
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await userService.update(selectedUser._id, editForm);
      toast.success("User updated successfully");
      setIsEditModalOpen(false);
      fetchUsers();
    } catch {
      toast.error("Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const user = users.find((u) => u._id === userId);
    if (!user || user.role === newRole) return;
    setRoleConfirm({ isOpen: true, userId, newRole, userName: user.name });
  };

  const executeRoleChange = async () => {
    const { userId, newRole, userName } = roleConfirm;
    setRoleConfirm((prev) => ({ ...prev, isOpen: false }));
    try {
      await userService.update(userId, { role: newRole });
      toast.success(`${userName} is now a ${newRole.replace("_", " ")}`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Role update failed");
    }
  };

  const downloadTemplate = () => {
    const rows = [
      "name,email,role,id,department,team,shift,designation,experience",
      "John Doe,john.doe@vdartinc.com,employee,EMP001,IT,Dev Team A,morning,Software Engineer,2 years",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(rows);
    a.download = "import_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleBulkImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await api.post("/users/bulk-import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(
        `${res.data.imported} imported, ${res.data.updated} updated, ${res.data.skipped} skipped`,
      );
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Import failed");
    } finally {
      setImporting(false);
      e.target.value = "";
    }
  };

  const handleBulkDelete = async () => {
    setDeleting(true);
    try {
      const res = await api.delete("/users/bulk-delete", {
        data: { userIds: selectedIds },
      });
      toast.success(
        `${res.data.deleted} user${res.data.deleted !== 1 ? "s" : ""} deleted`,
      );
      setSelectedIds([]);
      setShowDeleteConfirm(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const start = (page - 1) * PAGE_LIMIT + 1;
  const end = Math.min(page * PAGE_LIMIT, total);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-layout"
    >
      {/* ── Bulk Action Bar ── */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            style={{
              position: "sticky",
              top: "16px",
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#1F4E79",
              color: "white",
              padding: "10px 20px",
              borderRadius: "10px",
              marginBottom: "16px",
              boxShadow: "0 4px 20px rgba(31,78,121,0.3)",
            }}
          >
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              {selectedIds.length} user{selectedIds.length !== 1 ? "s" : ""}{" "}
              selected
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setSelectedIds([])}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  color: "white",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                }}
              >
                Clear
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  background: "#DC2626",
                  border: "none",
                  color: "white",
                  padding: "6px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                }}
              >
                Delete Selected
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Page Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 800,
              color: "var(--text-dark)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Team Management
          </h1>
          <p
            style={{
              color: "var(--text-dim)",
              fontSize: "0.875rem",
              marginTop: "4px",
              margin: "4px 0 0",
            }}
          >
            Manage users, roles, and access permissions
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={downloadTemplate}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              border: "1px solid var(--border)",
              background: "white",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--text-dim)",
            }}
          >
            <Download size={14} /> CSV Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              border: "1px solid var(--border)",
              background: "white",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "var(--text-dim)",
              opacity: importing ? 0.7 : 1,
            }}
          >
            <Upload size={14} /> {importing ? "Importing…" : "Import CSV"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            onChange={handleBulkImport}
          />
          <button
            onClick={() => setIsCreateModalOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              background: "#1F4E79",
              border: "none",
              color: "white",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            <UserPlus size={15} /> Add User
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div
        style={{
          background: "white",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "16px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flex: 1,
            flexWrap: "wrap",
          }}
        >
          {/* Search */}
          <div
            style={{
              position: "relative",
              minWidth: "220px",
              flex: 1,
              maxWidth: "340px",
            }}
          >
            <Search
              size={15}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-dim)",
                pointerEvents: "none",
              }}
            />
            <input
              placeholder="Search by name or email…"
              className="input"
              style={{
                paddingLeft: "32px",
                height: "34px",
                fontSize: "0.82rem",
                width: "100%",
                background: "var(--bg)",
                border: "1px solid transparent",
              }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Role pills */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {["", ...ROLES].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "999px",
                  border: "1px solid",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  borderColor: roleFilter === r ? "#1F4E79" : "var(--border)",
                  background: roleFilter === r ? "#1F4E79" : "transparent",
                  color: roleFilter === r ? "white" : "var(--text-dim)",
                }}
              >
                {r === ""
                  ? "All"
                  : r === "support_agent"
                    ? "Support"
                    : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span
            style={{
              fontSize: "0.78rem",
              color: "var(--text-dim)",
              fontWeight: 600,
            }}
          >
            {total.toLocaleString()} users
          </span>
          {/* View toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--surface-alt)",
              borderRadius: "7px",
              padding: "3px",
              border: "1px solid var(--border)",
              gap: "2px",
            }}
          >
            {[
              { mode: "list", icon: <LayoutList size={14} /> },
              { mode: "board", icon: <LayoutGrid size={14} /> },
            ].map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  localStorage.setItem("userViewMode", mode);
                }}
                style={{
                  padding: "5px 8px",
                  borderRadius: "5px",
                  border: "none",
                  cursor: "pointer",
                  background: viewMode === mode ? "white" : "transparent",
                  color: viewMode === mode ? "#1F4E79" : "var(--text-dim)",
                  boxShadow:
                    viewMode === mode ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                  display: "flex",
                  alignItems: "center",
                  transition: "all 0.15s",
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Board View ── */}
      {viewMode === "board" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${ROLES.length}, 1fr)`,
            gap: "16px",
            minHeight: "60vh",
          }}
        >
          {ROLES.map((role) => {
            const cfg = ROLE_CONFIG[role];
            const roleUsers = users.filter((u) => u.role === role);
            return (
              <div
                key={role}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleRoleChange(e.dataTransfer.getData("userId"), role);
                }}
                style={{
                  background: "var(--surface-alt)",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: cfg.color,
                    }}
                  >
                    {cfg.label}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: cfg.bg,
                      color: cfg.color,
                      padding: "2px 8px",
                      borderRadius: "999px",
                    }}
                  >
                    {roleUsers.length}
                  </span>
                </div>
                {roleUsers.map((u) => (
                  <motion.div
                    key={u._id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("userId", u._id);
                      e.target.style.opacity = "0.5";
                    }}
                    onDragEnd={(e) => {
                      e.target.style.opacity = "1";
                    }}
                    onClick={() => openEdit(u)}
                    whileHover={{ y: -2 }}
                    style={{
                      background: "white",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      cursor: "grab",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <Avatar name={u.name} size={30} />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.82rem",
                            color: "var(--text-dark)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {u.name}
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-dim)",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── List View / Table ── */
        <div
          style={{
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <colgroup>
              <col style={{ width: "44px" }} />
              <col style={{ width: "240px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "110px" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "52px" }} />
            </colgroup>
            <thead>
              <tr style={{ background: "#1F4E79" }}>
                <th style={{ padding: "12px 14px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    style={{
                      width: "15px",
                      height: "15px",
                      accentColor: "white",
                      cursor: "pointer",
                      display: "block",
                      margin: "0 auto",
                    }}
                  />
                </th>
                {[
                  "User",
                  "Role",
                  "Department",
                  "Workload",
                  "Last Login",
                  "Status",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "12px 14px",
                      textAlign:
                        h === "Workload" || h === "Status" || h === ""
                          ? "center"
                          : "left",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      color: "rgba(255,255,255,0.85)",
                      borderBottom: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td colSpan={8} style={{ padding: "10px 14px" }}>
                          <div
                            style={{
                              height: "36px",
                              background:
                                "linear-gradient(90deg, #F3F4F6 25%, #E5E7EB 50%, #F3F4F6 75%)",
                              backgroundSize: "400px 100%",
                              borderRadius: "6px",
                              animation: "shimmer 1.4s infinite linear",
                            }}
                          />
                        </td>
                      </tr>
                    ))
                  : users.map((u, idx) => {
                      const isSelected = selectedIds.includes(u._id);
                      return (
                        <motion.tr
                          key={u._id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.015 }}
                          onClick={() => openEdit(u)}
                          style={{
                            borderBottom: "1px solid #F3F4F6",
                            background: isSelected ? "#EFF6FF" : "white",
                            cursor: "pointer",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected)
                              e.currentTarget.style.background = "#FAFAFA";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isSelected
                              ? "#EFF6FF"
                              : "white";
                          }}
                        >
                          {/* Checkbox */}
                          <td
                            style={{
                              padding: "12px 14px",
                              textAlign: "center",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(u._id)}
                              style={{
                                width: "15px",
                                height: "15px",
                                accentColor: "#1F4E79",
                                cursor: "pointer",
                                display: "block",
                                margin: "0 auto",
                              }}
                            />
                          </td>

                          {/* User */}
                          <td style={{ padding: "12px 14px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "10px",
                                minWidth: 0,
                              }}
                            >
                              <Avatar name={u.name} size={36} />
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: "0.875rem",
                                    color: "var(--text-dark)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {u.name || "—"}
                                </div>
                                <div
                                  style={{
                                    fontSize: "0.72rem",
                                    color: "var(--text-dim)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    marginTop: "1px",
                                  }}
                                >
                                  {u.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td style={{ padding: "12px 14px" }}>
                            <RolePill role={u.role} />
                          </td>

                          {/* Department */}
                          <td
                            style={{
                              padding: "12px 14px",
                              fontSize: "0.82rem",
                              color: "var(--text-main)",
                              fontWeight: 500,
                            }}
                          >
                            {u.department || "—"}
                          </td>

                          {/* Workload */}
                          <td style={{ padding: "12px 14px" }}>
                            <WorkloadBar user={u} />
                          </td>

                          {/* Last Login */}
                          <td
                            style={{
                              padding: "12px 14px",
                              fontSize: "0.8rem",
                              color: "var(--text-dim)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {u.lastLogin ? (
                              timeAgo(u.lastLogin)
                            ) : (
                              <span style={{ color: "#D1D5DB" }}>Never</span>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "12px 14px" }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "5px",
                                flexWrap: "wrap",
                              }}
                            >
                              <StatusPill
                                type={u.isVerified ? "verified" : "pending"}
                              />
                              <StatusPill
                                type={u.isActive ? "active" : "inactive"}
                              />
                            </div>
                          </td>

                          {/* Actions */}
                          <td
                            style={{
                              padding: "12px 14px",
                              textAlign: "center",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => openEdit(u)}
                              style={{
                                background: "transparent",
                                border: "none",
                                cursor: "pointer",
                                color: "var(--text-dim)",
                                padding: "4px 6px",
                                borderRadius: "6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "background 0.1s",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background = "#F3F4F6")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "transparent")
                              }
                            >
                              <MoreHorizontal size={17} />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
              </AnimatePresence>
            </tbody>
          </table>

          {/* Empty state */}
          {!loading && users.length === 0 && (
            <div
              style={{
                padding: "60px 24px",
                textAlign: "center",
                color: "var(--text-dim)",
              }}
            >
              <Users size={32} style={{ marginBottom: "12px", opacity: 0.3 }} />
              <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                No users found
              </div>
              <div style={{ fontSize: "0.8rem", marginTop: "4px" }}>
                Try adjusting your search or filters
              </div>
            </div>
          )}

          {/* Pagination */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 20px",
              borderTop: "1px solid #F3F4F6",
              background: "#FAFAFA",
            }}
          >
            <span
              style={{
                fontSize: "0.8rem",
                color: "var(--text-dim)",
                fontWeight: 500,
              }}
            >
              {total > 0
                ? `Showing ${start}–${end} of ${total} users`
                : "No users found"}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1}
                style={{
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "white",
                  cursor: page <= 1 ? "not-allowed" : "pointer",
                  opacity: page <= 1 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from(
                { length: Math.min(totalPages, 5) },
                (_, i) => i + 1,
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  style={{
                    width: "30px",
                    height: "30px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: "1px solid",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    borderColor: page === p ? "#1F4E79" : "var(--border)",
                    background: page === p ? "#1F4E79" : "white",
                    color: page === p ? "white" : "var(--text-dim)",
                  }}
                >
                  {p}
                </button>
              ))}
              {totalPages > 5 && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-dim)",
                    padding: "0 2px",
                  }}
                >
                  …
                </span>
              )}
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                style={{
                  width: "30px",
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "white",
                  cursor: page >= totalPages ? "not-allowed" : "pointer",
                  opacity: page >= totalPages ? 0.4 : 1,
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role Confirm Modal ── */}
      <Modal
        isOpen={roleConfirm.isOpen}
        onClose={() => setRoleConfirm((prev) => ({ ...prev, isOpen: false }))}
        title="Confirm Role Change"
        footer={
          <div className="flex-center gap-3">
            <Button
              variant="ghost"
              onClick={() =>
                setRoleConfirm((prev) => ({ ...prev, isOpen: false }))
              }
            >
              Cancel
            </Button>
            <Button onClick={executeRoleChange}>Update Role</Button>
          </div>
        }
      >
        <p
          style={{
            fontSize: "0.95rem",
            fontWeight: 500,
            color: "var(--text-main)",
          }}
        >
          Change <strong>{roleConfirm.userName}</strong>'s role to{" "}
          <strong>{roleConfirm.newRole?.replace("_", " ")}</strong>?
        </p>
      </Modal>

      {/* ── Edit Modal ── */}
      {isEditModalOpen && selectedUser && (
        <div
          className="modal-overlay"
          onClick={() => setIsEditModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header flex-between">
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <Avatar name={selectedUser.name} size={40} />
                <div>
                  <h3 className="card-title" style={{ marginBottom: 0 }}>
                    {selectedUser.name}
                  </h3>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-dim)",
                      margin: 0,
                    }}
                  >
                    {selectedUser.email}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
              >
                ✕
              </Button>
            </div>
            <div className="modal-body">
              <div className="flex-col gap-6">
                <div className="input-group">
                  <label className="input-label">Role</label>
                  <select
                    className="input"
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Department</label>
                  <select
                    className="input"
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm({ ...editForm, department: e.target.value })
                    }
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  className="flex-between p-4"
                  style={{
                    background: "var(--bg)",
                    borderRadius: "var(--r-md)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>
                      Active Account
                    </div>
                    <p
                      style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}
                    >
                      Allow user to sign in.
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setEditForm({ ...editForm, isActive: !editForm.isActive })
                    }
                    style={{
                      width: "44px",
                      height: "22px",
                      background: editForm.isActive
                        ? "#10B981"
                        : "var(--text-dim)",
                      borderRadius: "var(--r-full)",
                      position: "relative",
                      transition: "var(--t-fast)",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: "2px",
                        left: editForm.isActive ? "24px" : "2px",
                        width: "18px",
                        height: "18px",
                        background: "white",
                        borderRadius: "50%",
                        transition: "var(--t-fast)",
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
                Discard
              </Button>
              <Button
                variant="outline"
                leftIcon={<KeyRound size={16} />}
                onClick={() => {
                  setIsEditModalOpen(false);
                  setIsResetModalOpen(true);
                }}
              >
                Reset Password
              </Button>
              <Button isLoading={saving} onClick={handleUpdate}>
                Save Changes
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {isResetModalOpen && selectedUser && (
        <div
          className="modal-overlay"
          onClick={() => setIsResetModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px" }}
          >
            <div className="modal-header">
              <h3 className="card-title">Reset Password</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                New password for {selectedUser.name}.
              </p>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">New Password</label>
                <input
                  className="input"
                  type="password"
                  placeholder="Min 8 characters"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button
                variant="ghost"
                onClick={() => setIsResetModalOpen(false)}
              >
                Cancel
              </Button>
              <Button isLoading={resetting} onClick={handleResetPassword}>
                Reset & Send Email
              </Button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Create User Modal ── */}
      {isCreateModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setIsCreateModalOpen(false);
            setCreatedPassword(null);
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="card-title">Add New User</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                Credentials are stored securely.
              </p>
            </div>
            {createdPassword ? (
              <div className="modal-body">
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1.5px solid #86EFAC",
                    borderRadius: "10px",
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "#166534",
                      marginBottom: "8px",
                    }}
                  >
                    User Created Successfully
                  </div>
                  <p
                    style={{
                      fontSize: "0.82rem",
                      color: "#166534",
                      marginBottom: "16px",
                    }}
                  >
                    Store this password securely — it will not be shown again.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "white",
                      border: "1.5px solid #1F4E79",
                      borderRadius: "8px",
                      padding: "10px 14px",
                    }}
                  >
                    <code
                      style={{
                        flex: 1,
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        letterSpacing: "3px",
                        color: "#1F4E79",
                      }}
                    >
                      {createdPassword}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdPassword);
                        toast.success("Copied!");
                      }}
                      style={{
                        background: "#1F4E79",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 14px",
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: "0.82rem",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="modal-body flex-col gap-4">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Work Email *</label>
                    <input
                      className="input"
                      placeholder="name@vdartinc.com"
                      value={createForm.email}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Full Name *</label>
                    <input
                      className="input"
                      placeholder="Full name"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Role</label>
                    <select
                      className="input"
                      value={createForm.role}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, role: e.target.value })
                      }
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Department</label>
                    <select
                      className="input"
                      value={createForm.department}
                      onChange={(e) =>
                        setCreateForm({
                          ...createForm,
                          department: e.target.value,
                        })
                      }
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-grid-2">
                  <div className="form-grid-2">
  <div className="input-group">
    <label className="input-label">Designation</label>
    <input
      className="input"
      placeholder="e.g. Developer"
      value={createForm.designation}
      onChange={(e) =>
        setCreateForm({
          ...createForm,
          designation: e.target.value,
        })
      }
    />
  </div>

  <div className="input-group">
    <label className="input-label">Employee ID</label>

    <input
      className="input"
      placeholder="EMP001"
      value={createForm.employeeId}
      onChange={(e) =>
        setCreateForm({
          ...createForm,
          employeeId: e.target.value
        })
      }
    />
  </div>
</div>
                  <div className="input-group">
                    <label className="input-label">
                      Password{" "}
                      <span
                        style={{ color: "var(--text-dim)", fontWeight: 400 }}
                      >
                        (leave blank to auto-generate)
                      </span>
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        className="input"
                        type="text"
                        placeholder="Auto-generated if empty"
                        value={createForm.password}
                        onChange={(e) =>
                          setCreateForm({
                            ...createForm,
                            password: e.target.value,
                          })
                        }
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCreateForm({
                            ...createForm,
                            password: generatePassword(),
                          })
                        }
                        style={{
                          background: "var(--bg)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--r-md)",
                          padding: "0 12px",
                          cursor: "pointer",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "var(--primary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="modal-footer">
              <Button
                variant="ghost"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreatedPassword(null);
                }}
              >
                Close
              </Button>
              {!createdPassword && (
                <Button isLoading={creating} onClick={handleCreate}>
                  Create User
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Bulk Delete Confirm ── */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "440px" }}
          >
            <div className="modal-header">
              <h3 className="card-title" style={{ color: "#DC2626" }}>
                Delete Users
              </h3>
            </div>
            <div className="modal-body">
              <p
                style={{
                  fontSize: "0.95rem",
                  lineHeight: 1.6,
                  color: "var(--text-main)",
                }}
              >
                Permanently delete{" "}
                <strong style={{ color: "#DC2626" }}>
                  {selectedIds.length} user{selectedIds.length !== 1 ? "s" : ""}
                </strong>
                ?
                <br />
                <span style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>
                  This action cannot be undone.
                </span>
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                style={{
                  background: "#DC2626",
                  color: "white",
                  border: "none",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: 700,
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting
                  ? "Deleting…"
                  : `Delete ${selectedIds.length} User${selectedIds.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
    </motion.div>
  );
}
