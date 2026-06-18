import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Camera,
  Upload,
  X,
  RotateCcw,
  CheckCircle2,
  Shield,
  Bell,
  Key,
  Monitor,
  Settings,
  ChevronRight,
  LogOut,
  BadgeCheck,
  User,
  MapPin,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { userService } from "../services/ticketService";
import { getInitials, getAvatarColor } from "../utils/helpers";
import { Card, Button, Input, Badge } from "../ui";
import { motion, AnimatePresence } from "framer-motion";

// ─── Indian States ────────────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

// ─── Shared menu item style ───────────────────────────────────────────────────
const menuItemStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "10px 14px",
  border: "none",
  background: "transparent",
  borderRadius: "10px",
  cursor: "pointer",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--text-main)",
  transition: "background 0.15s",
  textAlign: "left",
};

// ─── Section label style ──────────────────────────────────────────────────────
const sectionLabelStyle = {
  marginBottom: "var(--s-4, 16px)",
  fontSize: "0.7rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--primary, #4F46E5)",
  display: "flex",
  alignItems: "center",
  gap: "6px",
};

// ─── Settings Dropdown ────────────────────────────────────────────────────────
function SettingsDropdown({ onSelect, onClose, onSignOut }) {
  const items = [
    { id: "security", label: "Security & Auth", icon: Shield, color: "#2563EB", bg: "#DBEAFE" },
    { id: "notifications", label: "Notifications", icon: Bell, color: "#7C3AED", bg: "#EDE9FE" },
  ];

  return (
    <motion.div
      data-settings-menu="true"
      initial={{ opacity: 0, scale: 0.92, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        background: "white",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
        padding: "8px",
        zIndex: 9999,
        minWidth: "220px",
      }}
    >
      <p style={{
        padding: "6px 14px 8px",
        fontSize: "0.7rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        color: "var(--text-dim)",
        borderBottom: "1px solid var(--border-light)",
        marginBottom: "6px",
      }}>
        Settings
      </p>

      {items.map(({ id, label, icon: Icon, color, bg }) => (
        <button
          key={id}
          onClick={() => { onSelect(id); onClose(); }}
          style={menuItemStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={14} color={color} />
            </div>
            {label}
          </div>
          <ChevronRight size={14} color="var(--text-dim)" />
        </button>
      ))}

      <div style={{ borderTop: "1px solid var(--border-light)", marginTop: "6px", paddingTop: "6px" }}>
        <button
          onClick={() => { onSignOut(); onClose(); }}
          style={{ ...menuItemStyle, color: "#DC2626" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LogOut size={14} color="#DC2626" />
            </div>
            Sign Out
          </div>
        </button>
      </div>
    </motion.div>
  );
}

// ─── Avatar Upload Menu (Portal) ─────────────────────────────────────────────
function AvatarUploadMenu({ anchorRef, hasAvatar, onUpload, onCamera, onRemove }) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX + rect.width / 2,
      });
    }
  }, [anchorRef]);

  return ReactDOM.createPortal(
    <motion.div
      data-avatar-menu="true"
      initial={{ opacity: 0, scale: 0.92, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }}
      transition={{ duration: 0.15 }}
      style={{
        position: "absolute",
        top: coords.top,
        left: coords.left,
        transform: "translateX(-50%)",
        background: "white",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        padding: "8px",
        zIndex: 9999,
        minWidth: "210px",
      }}
    >
      <button
        onClick={onUpload}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Upload size={16} />
          <span>Upload from computer</span>
        </div>
      </button>
      <button
        onClick={onCamera}
        style={menuItemStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Camera size={16} />
          <span>Take a photo</span>
        </div>
      </button>
      {hasAvatar && (
        <button
          onClick={onRemove}
          style={{ ...menuItemStyle, color: "var(--danger)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <X size={16} />
            <span>Remove photo</span>
          </div>
        </button>
      )}
    </motion.div>,
    document.body,
  );
}

// ─── Camera Modal ─────────────────────────────────────────────────────────────
function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [captured, setCaptured] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => videoRef.current.play();
      }
    } catch (err) {
      setError(err.message || "Camera access denied.");
    }
  };

  const stopCamera = () => stream?.getTracks().forEach((t) => t.stop());

  const handleCapture = () => {
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    setCaptured(c.toDataURL("image/jpeg", 0.9));
    stopCamera();
  };

  const handleRetake = () => {
    setCaptured(null);
    startCamera();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
        zIndex: 1000, display: "flex", alignItems: "center",
        justifyContent: "center", padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) { stopCamera(); onClose(); } }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{ background: "white", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "480px" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Take a Photo</h3>
          <button
            onClick={() => { stopCamera(); onClose(); }}
            style={{ border: "none", background: "var(--surface-alt)", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={16} />
          </button>
        </div>

        {error ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-dim)" }}>
            <Camera size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
            <p style={{ fontSize: "0.9rem" }}>{error}</p>
          </div>
        ) : (
          <>
            <div style={{ borderRadius: "14px", overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
              {!captured ? (
                <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
              ) : (
                <img src={captured} alt="Captured" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "center" }}>
              {!captured ? (
                <button
                  onClick={handleCapture}
                  style={{ width: "64px", height: "64px", borderRadius: "50%", border: "4px solid var(--primary)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--primary)" }} />
                </button>
              ) : (
                <>
                  <Button variant="outline" leftIcon={<RotateCcw size={16} />} onClick={handleRetake}>Retake</Button>
                  <Button onClick={() => { onCapture(captured); onClose(); }} leftIcon={<CheckCircle2 size={16} />}>Use Photo</Button>
                </>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Build profile state from user object ────────────────────────────────────
function buildProfileFromUser(user) {
  return {
    fullName: user?.name || "",
    email: user?.email || "",
    employeeId: user?.employeeId || user?.empId || "",
    phone: user?.phone || user?.mobileNumber || "",
    designation: user?.designation || "",
    preferredContact: user?.preferredContact || "email",
    location: {
      address1: user?.location?.address1 || "",
      address2: user?.location?.address2 || "",
      city: user?.location?.city || "",
      district: user?.location?.district || "",
      state: user?.location?.state || "",
      pincode: user?.location?.pincode || "",
    },
  };
}

// ─── Page config ─────────────────────────────────────────────────────────────
const PAGE_CONFIG = {
  profile: {
    title: "Basic Profile",
    subtitle: "Update your account information and preferences.",
  },
  security: {
    title: "Security & Authentication",
    subtitle: "Manage your password, 2FA, and active sessions.",
  },
  notifications: {
    title: "Notification Preferences",
    subtitle: "Manage how and when you receive updates about your tickets.",
  },
};

// ─── Reusable locked/editable field style helper ──────────────────────────────
const lockedStyle = { background: "#F9FAFB", cursor: "default" };

// ─── Main Export ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeView, setActiveView] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false); // ← single edit toggle for whole page

  const [profile, setProfile] = useState(() => buildProfileFromUser(user));
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const fileInputRef = useRef(null);
  const cameraButtonRef = useRef(null);
  const avatarMenuRef = useRef(null);
  const settingsButtonRef = useRef(null);

  // Re-sync form whenever auth `user` changes (after save OR refresh)
  useEffect(() => {
    if (!user) return;
    setProfile(buildProfileFromUser(user));
    setAvatarUrl(user.avatar || null);
  }, [user]);

  // Cancel should also reset form to last saved state
  const handleCancel = () => {
    setProfile(buildProfileFromUser(user));
    setIsEditing(false);
  };

  // Close menus on outside click
  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest("[data-avatar-menu]")) return;
      if (
        avatarMenuRef.current &&
        !avatarMenuRef.current.contains(e.target) &&
        cameraButtonRef.current &&
        !cameraButtonRef.current.contains(e.target)
      ) setShowAvatarMenu(false);

      if (e.target.closest("[data-settings-menu]")) return;
      if (settingsButtonRef.current && !settingsButtonRef.current.contains(e.target))
        setShowSettingsMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Avatar handlers ──────────────────────────────────────────────────────────
  const uploadAvatar = async (dataUrl) => {
    try {
      const res = await userService.updateProfile({ avatar: dataUrl });
      const updated = res?.data?.user || res?.data?.data || res?.data;
      updateUser(updated);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please select an image"); return; }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      setAvatarUrl(dataUrl);
      try { await uploadAvatar(dataUrl); } catch { toast.error("Upload failed"); }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCameraCapture = async (dataUrl) => {
    setAvatarUrl(dataUrl);
    await uploadAvatar(dataUrl);
  };

  const handleRemoveAvatar = async () => {
    setAvatarUrl(null);
    setShowAvatarMenu(false);
    try {
      const res = await userService.updateProfile({ avatar: null });
      const updated = res?.data?.user || res?.data?.data || res?.data;
      updateUser(updated);
      toast.success("Profile photo removed");
    } catch {
      toast.error("Failed to remove photo");
    }
  };

  // ── Profile save ─────────────────────────────────────────────────────────────
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await userService.updateProfile({
        name: profile.fullName,
        email: profile.email,
        employeeId: profile.employeeId,
        phone: profile.phone,
        designation: profile.designation,
        preferredContact: profile.preferredContact,
        location: profile.location,
      });
      const updated = res?.data?.user || res?.data?.data || res?.data;
      updateUser(updated);
      toast.success("Profile updated successfully");
      setIsEditing(false); // ← auto-close after save
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  // ── Password change ──────────────────────────────────────────────────────────
  const handleChangePassword = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword)
      return toast.error("Passwords do not match");
    if (passwords.newPassword.length < 8)
      return toast.error("Password must be at least 8 characters");
    setLoading(true);
    try {
      await userService.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      toast.success("Password changed successfully");
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      toast.error(err.response?.data?.message || "Password change failed");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate("/forgot-password");
  };

  // ── Password strength ────────────────────────────────────────────────────────
  const passwordStrength = (() => {
    const len = passwords.newPassword.length;
    if (!len) return { pct: 0, color: "#E5E7EB", label: "" };
    if (len < 4) return { pct: 20, color: "#EF4444", label: "Very weak" };
    if (len < 8) return { pct: 50, color: "#F59E0B", label: "Fair" };
    const hasNum = /\d/.test(passwords.newPassword);
    const hasSym = /[^A-Za-z0-9]/.test(passwords.newPassword);
    if (hasNum && hasSym) return { pct: 100, color: "#10B981", label: "Strong" };
    if (hasNum || hasSym) return { pct: 75, color: "#3B82F6", label: "Good" };
    return { pct: 60, color: "#F59E0B", label: "Moderate" };
  })();

  const { title, subtitle } = PAGE_CONFIG[activeView];

  // ── Card header ──────────────────────────────────────────────────────────────
  const cardHeader = (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      marginBottom: "var(--s-4)", background: "white", border: "1px solid var(--border)",
      borderRadius: "16px", padding: "20px 24px",
    }}>
      <div>
        <h2 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "4px", color: "var(--text-main)" }}>
          {title}
        </h2>
        <p style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>{subtitle}</p>
      </div>

      {activeView === "profile" && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", position: "relative" }}>

          {/* ── Single Edit / Cancel toggle for entire profile ── */}
          <button
            type="button"
            onClick={() => isEditing ? handleCancel() : setIsEditing(true)}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "7px 14px", borderRadius: "10px",
              border: `1px solid ${isEditing ? "var(--primary)" : "var(--border)"}`,
              background: isEditing ? "#EEF2FF" : "white",
              color: isEditing ? "var(--primary)" : "var(--text-dim)",
              cursor: "pointer", fontSize: "0.82rem", fontWeight: 600,
              transition: "all 0.15s",
            }}
          >
            {isEditing ? <><X size={13} /> Cancel</> : <> Edit Profile</>}
          </button>

          {/* ── Settings gear ── */}
          <button
            ref={settingsButtonRef}
            onClick={() => setShowSettingsMenu((v) => !v)}
            style={{
              width: "36px", height: "36px", borderRadius: "10px",
              border: "1px solid var(--border)",
              background: showSettingsMenu ? "var(--surface-alt)" : "white",
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", transition: "all 0.15s",
              color: showSettingsMenu ? "var(--primary)" : "var(--text-dim)",
            }}
            title="Settings"
          >
            <motion.div animate={{ rotate: showSettingsMenu ? 45 : 0 }} transition={{ duration: 0.2 }}>
              <Settings size={16} />
            </motion.div>
          </button>

          <AnimatePresence>
            {showSettingsMenu && (
              <SettingsDropdown
                onSelect={(id) => setActiveView(id)}
                onClose={() => setShowSettingsMenu(false)}
                onSignOut={() => { logout(); navigate("/login"); }}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />

      {/* Camera modal */}
      <AnimatePresence>
        {showCameraModal && (
          <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCameraModal(false)} />
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout">
        <AnimatePresence mode="wait">

          {/* ══════════════════════════════════════════════
              PROFILE VIEW
          ══════════════════════════════════════════════ */}
          {activeView === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              {cardHeader}

              <Card>
                <form onSubmit={handleUpdateProfile} className="flex-col gap-6">

                  {/* ── Avatar + User Summary ── */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "16px",
                    paddingBottom: "var(--s-6)", borderBottom: "1px solid var(--border-light)",
                  }}>
                    {/* Avatar */}
                    <div ref={avatarMenuRef} style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{
                        width: "72px", height: "72px", borderRadius: "50%",
                        border: "2px solid #4F7CFF", overflow: "hidden",
                        background: avatarUrl ? "transparent" : getAvatarColor(user?.name),
                        color: "#fff", display: "flex", alignItems: "center",
                        justifyContent: "center", fontWeight: 700, fontSize: "1.2rem",
                      }}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          getInitials(user?.name)
                        )}
                      </div>

                      {/* Camera button */}
                      <button
                        type="button"
                        ref={cameraButtonRef}
                        onClick={() => setShowAvatarMenu((v) => !v)}
                        style={{
                          position: "absolute", bottom: "-2px", right: "-2px",
                          width: "24px", height: "24px", borderRadius: "50%",
                          border: "2px solid white", background: "#4F46E5",
                          color: "#fff", cursor: "pointer", display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Camera size={12} />
                      </button>

                      <AnimatePresence>
                        {showAvatarMenu && (
                          <AvatarUploadMenu
                            anchorRef={cameraButtonRef}
                            hasAvatar={!!avatarUrl}
                            onUpload={() => { setShowAvatarMenu(false); setTimeout(() => fileInputRef.current?.click(), 150); }}
                            onCamera={() => { setShowAvatarMenu(false); setTimeout(() => setShowCameraModal(true), 150); }}
                            onRemove={handleRemoveAvatar}
                          />
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Name + role + email summary */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-main)" }}>
                          {user?.name}
                        </span>
                        <Badge style={{ background: "#EEF2FF", color: "#4F46E5", fontSize: "10px", padding: "3px 8px", borderRadius: "999px" }}>
                          {user?.role?.toUpperCase()}
                        </Badge>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-dim)", fontSize: "0.85rem" }}>
                        <Mail size={13} />
                        {user?.email}
                      </div>
                      {profile.employeeId && (
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-dim)", fontSize: "0.8rem", marginTop: "2px" }}>
                          <BadgeCheck size={12} />
                          {profile.employeeId}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Section: Personal Information ── */}
                  <div>
                    <p style={sectionLabelStyle}>
                      <User size={11} />
                      Personal Information
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", opacity: isEditing ? 1 : 0.85 }}>
                    <Input
                      label="Full Name"
                      value={profile.fullName}
                      readOnly={!isEditing}
                      style={!isEditing ? lockedStyle : {}}
                      onChange={(e) => setProfile({ ...profile, fullName: e.target.value })}
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={profile.email}
                      readOnly={!isEditing}
                      style={!isEditing ? lockedStyle : {}}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    />
                    <Input
                      label="Employee ID"
                      value={profile.employeeId}
                      readOnly
                      style={{ background: "#F9FAFB", cursor: "not-allowed" }}
                    />
                    <Input
                      label="Designation"
                      value={profile.designation}
                      readOnly={!isEditing}
                      style={!isEditing ? lockedStyle : {}}
                      onChange={(e) => setProfile({ ...profile, designation: e.target.value })}
                    />
                    <div className="input-group">
                      <label className="input-label">Phone Number</label>
                      <input
                        className="input"
                        placeholder="+91 9876543210"
                        value={profile.phone}
                        readOnly={!isEditing}
                        style={!isEditing ? lockedStyle : {}}
                        onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Preferred Contact</label>
                      <select
                        className="input"
                        value={profile.preferredContact}
                        disabled={!isEditing}
                        style={!isEditing ? lockedStyle : {}}
                        onChange={(e) => setProfile({ ...profile, preferredContact: e.target.value })}
                      >
                        <option value="email">Email Address</option>
                        <option value="phone">Phone Call</option>
                        <option value="slack">Slack Message</option>
                      </select>
                    </div>
                  </div>

                  {/* ── Section: Work Location ── */}
                  <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s-6)" }}>
                    <p style={sectionLabelStyle}>
                      <MapPin size={11} />
                      Work Location
                    </p>

                    <div className="flex-col gap-4" style={{ opacity: isEditing ? 1 : 0.85 }}>
                      <div className="form-grid-2">
                        <Input
                          label={<>Address 1 <span style={{ color: "var(--danger)" }}>*</span></>}
                          placeholder="Street address, P.O. box"
                          value={profile.location.address1}
                          readOnly={!isEditing}
                          style={!isEditing ? lockedStyle : {}}
                          onChange={(e) => setProfile({ ...profile, location: { ...profile.location, address1: e.target.value } })}
                        />
                        <Input
                          label={<>Address 2 <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(Optional)</span></>}
                          placeholder="Apartment, suite, unit, building, floor, etc."
                          value={profile.location.address2}
                          readOnly={!isEditing}
                          style={!isEditing ? lockedStyle : {}}
                          onChange={(e) => setProfile({ ...profile, location: { ...profile.location, address2: e.target.value } })}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "var(--s-4)" }}>
                        <Input
                          label={<>City <span style={{ color: "var(--danger)" }}>*</span></>}
                          placeholder="City"
                          value={profile.location.city}
                          readOnly={!isEditing}
                          style={!isEditing ? lockedStyle : {}}
                          onChange={(e) => setProfile({ ...profile, location: { ...profile.location, city: e.target.value } })}
                        />
                        <div className="input-group">
                          <label className="input-label">District <span style={{ color: "var(--danger)" }}>*</span></label>
                          <select
                            className="input"
                            value={profile.location.district}
                            disabled={!isEditing}
                            style={!isEditing ? lockedStyle : {}}
                            onChange={(e) => setProfile({ ...profile, location: { ...profile.location, district: e.target.value } })}
                          >
                            <option value="">Select District</option>
                            {["Chennai","Coimbatore","Madurai","Salem","Trichy","Bengaluru Urban","Mumbai City","Hyderabad","Pune","Other"].map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="input-group">
                          <label className="input-label">State <span style={{ color: "var(--danger)" }}>*</span></label>
                          <select
                            className="input"
                            value={profile.location.state}
                            disabled={!isEditing}
                            style={!isEditing ? lockedStyle : {}}
                            onChange={(e) => setProfile({ ...profile, location: { ...profile.location, state: e.target.value } })}
                          >
                            <option value="">Select State</option>
                            {INDIAN_STATES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <Input
                          label={<>Pincode <span style={{ color: "var(--danger)" }}>*</span></>}
                          placeholder="6-digit code"
                          maxLength={6}
                          value={profile.location.pincode}
                          readOnly={!isEditing}
                          style={!isEditing ? lockedStyle : {}}
                          onChange={(e) => setProfile({ ...profile, location: { ...profile.location, pincode: e.target.value.replace(/\D/g, "") } })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* ── Save button — only visible while editing ── */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.15 }}
                        style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "var(--s-4)" }}
                      >
                        <Button type="button" variant="outline" onClick={handleCancel}>
                          Discard
                        </Button>
                        <Button type="submit" isLoading={loading}>
                          Save Updates
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </form>
              </Card>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════
              SECURITY VIEW
          ══════════════════════════════════════════════ */}
          {activeView === "security" && (
            <motion.div
              key="security"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <Card style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--s-6)" }}>
                  <div>
                    <h2 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "4px", color: "var(--text-main)" }}>
                      Security & Authentication
                    </h2>
                    <p style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>
                      Manage your password, 2FA, and active sessions.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveView("profile")}
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "white", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-dim)", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text-main)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  >
                    ← Back
                  </button>
                </div>

                <div className="flex-col gap-5">
                  <Input
                    type="password" label="Current Password" placeholder="••••••••"
                    value={passwords.currentPassword}
                    onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                  />
                  <div className="form-grid-2">
                    <Input
                      type="password" label="New Password" placeholder="••••••••"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    />
                    <Input
                      type="password" label="Confirm Password" placeholder="••••••••"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    />
                  </div>

                  {/* Password strength bar */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <small style={{ color: "var(--text-dim)", fontSize: "0.78rem" }}>
                        Use at least 8 characters including numbers and symbols.
                      </small>
                      {passwordStrength.label && (
                        <small style={{ color: passwordStrength.color, fontWeight: 600, fontSize: "0.78rem" }}>
                          {passwordStrength.label}
                        </small>
                      )}
                    </div>
                    <div style={{ height: "6px", borderRadius: "999px", background: "#E5E7EB", overflow: "hidden" }}>
                      <motion.div
                        animate={{ width: `${passwordStrength.pct}%` }}
                        transition={{ duration: 0.3 }}
                        style={{ height: "100%", background: passwordStrength.color, borderRadius: "999px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <Button onClick={handleChangePassword} isLoading={loading} leftIcon={<Key size={16} />}>
                      Update Password
                    </Button>
                    <button
                      onClick={handleForgotPassword}
                      style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontWeight: 600 }}
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>
              </Card>

              {/* 2FA + Sessions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <Card>
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ width: "54px", height: "54px", borderRadius: "14px", background: "#DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Shield size={24} color="#2563EB" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: "8px", fontSize: "1rem", fontWeight: 700 }}>Two-Factor Authentication</h3>
                      <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: "16px" }}>
                        Add an extra layer of security by requiring a verification code.
                      </p>
                      <Button variant="outline">Configure 2FA →</Button>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ width: "54px", height: "54px", borderRadius: "14px", background: "#FCE7F3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Monitor size={24} color="#DB2777" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ marginBottom: "8px", fontSize: "1rem", fontWeight: 700 }}>Active Sessions</h3>
                      <p style={{ color: "var(--text-dim)", fontSize: "0.9rem", marginBottom: "16px" }}>
                        You are currently logged in on 3 devices.
                      </p>
                      <Button variant="outline">View Sessions →</Button>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Deactivate account */}
              <Card style={{ marginTop: "24px", border: "1px solid #FECACA", background: "#FEF2F2" }}>
                <div className="flex-between">
                  <div>
                    <h3 style={{ color: "#DC2626", marginBottom: "6px" }}>Deactivate Account</h3>
                    <p style={{ color: "#7F1D1D", fontSize: "0.9rem" }}>Permanently remove your access to the portal.</p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => {
                      if (window.confirm("Are you sure? This action requires administrator approval."))
                        toast.warning("Account deactivation requires administrator approval.");
                    }}
                  >
                    Deactivate
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* ══════════════════════════════════════════════
              NOTIFICATIONS VIEW
          ══════════════════════════════════════════════ */}
          {activeView === "notifications" && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--s-6)" }}>
                  <div>
                    <h2 style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "4px", color: "var(--text-main)" }}>
                      Notification Preferences
                    </h2>
                    <p style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>
                      Manage how and when you receive updates about your tickets.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveView("profile")}
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "10px", border: "1px solid var(--border)", background: "white", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-dim)", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; e.currentTarget.style.color = "var(--text-main)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "var(--text-dim)"; }}
                  >
                    ← Back
                  </button>
                </div>

                <div className="flex-col gap-4">
                  {[
                    { id: "email", label: "Email Notifications", desc: "Receive status updates and replies via email." },
                    { id: "inApp", label: "In-App Alerts", desc: "Show real-time toast notifications in the portal." },
                    { id: "onAssign", label: "Assignment Alerts", desc: "Notify me when I am assigned to a ticket." },
                    { id: "onComment", label: "Comment Alerts", desc: "Notify me when someone comments on my tickets." },
                  ].map((pref) => {
                    const isOn = !!user?.notificationPreferences?.[pref.id];
                    return (
                      <div
                        key={pref.id}
                        className="flex-between"
                        style={{ padding: "16px 20px", background: "var(--surface-alt)", borderRadius: "16px", border: "1px solid var(--border)" }}
                      >
                        <div className="flex-col">
                          <span style={{ fontWeight: 700, color: "var(--text-main)" }}>{pref.label}</span>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{pref.desc}</span>
                        </div>
                        <div
                          role="switch"
                          aria-checked={isOn}
                          onClick={async () => {
                            const newPrefs = { ...user.notificationPreferences, [pref.id]: !isOn };
                            try {
                              const res = await userService.updateProfile({ notificationPreferences: newPrefs });
                              const updated = res?.data?.user || res?.data?.data || res?.data;
                              updateUser(updated);
                              toast.success(`${pref.label} ${!isOn ? "enabled" : "disabled"}`);
                            } catch {
                              toast.error("Failed to update preference");
                            }
                          }}
                          style={{
                            width: "44px", height: "24px",
                            background: isOn ? "var(--primary)" : "var(--border)",
                            borderRadius: "20px", padding: "4px", cursor: "pointer",
                            display: "flex", justifyContent: isOn ? "flex-end" : "flex-start",
                            transition: "all 0.2s ease", flexShrink: 0,
                          }}
                        >
                          <motion.div
                            layout
                            style={{ width: "16px", height: "16px", background: "white", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </>
  );
}