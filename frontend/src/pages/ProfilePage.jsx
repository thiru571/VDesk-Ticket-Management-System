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
  User,
  Shield,
  Bell,
  Key,
  KeyRound,
  Monitor,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { userService } from "../services/ticketService";
import { getInitials, getAvatarColor } from "../utils/helpers";
import { Card, Button, Input, Badge } from "../ui";
import { motion, AnimatePresence } from "framer-motion";

// ─── Indian States ─────────────────────────────────────────────────────────────
const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh",
  "Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka",
  "Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram",
  "Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu",
  "Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal",
  "Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

const TABS = [
  { id: "profile",       label: "General info",    icon: User   },
  { id: "security",      label: "Security & Auth", icon: Shield },
  { id: "notifications", label: "Notifications",   icon: Bell   },
];

// ─── Avatar Upload Dropdown ───────────────────────────────────────────────────
const menuItemStyle = {
  display: "flex", alignItems: "center", gap: "10px", width: "100%",
  padding: "10px 14px", border: "none", background: "transparent",
  borderRadius: "10px", cursor: "pointer", fontSize: "0.875rem",
  fontWeight: 500, color: "var(--text-main)", transition: "background 0.15s",
  textAlign: "left",
};

function AvatarUploadMenu({ anchorRef, hasAvatar, onUpload, onCamera, onRemove }) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX + rect.width / 2 });
    }
  }, [anchorRef]);
  return ReactDOM.createPortal(
    <motion.div
      data-avatar-menu="true"
      initial={{ opacity: 0, scale: 0.92, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -6 }} transition={{ duration: 0.15 }}
      style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translateX(-50%)", background: "white", border: "1px solid var(--border)", borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.18)", padding: "8px", zIndex: 9999, minWidth: "210px" }}
    >
      <button onClick={onUpload} style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <Upload size={16} /><span>Upload from computer</span>
      </button>
      <button onClick={onCamera} style={menuItemStyle} onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-alt)")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
        <Camera size={16} /><span>Take a photo</span>
      </button>
      {hasAvatar && (
        <button onClick={onRemove} style={{ ...menuItemStyle, color: "var(--danger)" }}>
          <X size={16} /><span>Remove photo</span>
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

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setStream(s);
      if (videoRef.current) { videoRef.current.srcObject = s; videoRef.current.onloadedmetadata = () => videoRef.current.play(); }
    } catch (err) { setError(err.message || "Camera access denied."); }
  };
  const stopCamera = () => stream?.getTracks().forEach((t) => t.stop());
  const handleCapture = () => {
    const v = videoRef.current, c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    setCaptured(c.toDataURL("image/jpeg", 0.9)); stopCamera();
  };
  const handleRetake = () => { setCaptured(null); startCamera(); };
  const handleUse = () => { onCapture(captured); onClose(); };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={(e) => { if (e.target === e.currentTarget) { stopCamera(); onClose(); } }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        style={{ background: "white", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "480px", boxShadow: "0 24px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>Take a Photo</h3>
          <button onClick={() => { stopCamera(); onClose(); }} style={{ border: "none", background: "var(--surface-alt)", borderRadius: "50%", width: "32px", height: "32px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
              {!captured ? <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                : <img src={captured} alt="Captured" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <div style={{ display: "flex", gap: "12px", marginTop: "16px", justifyContent: "center" }}>
              {!captured ? (
                <button onClick={handleCapture} style={{ width: "64px", height: "64px", borderRadius: "50%", border: "4px solid var(--primary)", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--primary)" }} />
                </button>
              ) : (
                <>
                  <Button variant="outline" leftIcon={<RotateCcw size={16} />} onClick={handleRetake}>Retake</Button>
                  <Button onClick={handleUse} leftIcon={<CheckCircle2 size={16} />}>Use Photo</Button>
                </>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Profile Page ────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);

  const fileInputRef = useRef(null);
  const cameraButtonRef = useRef(null);
  const avatarMenuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest("[data-avatar-menu]")) return;
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target) &&
          cameraButtonRef.current && !cameraButtonRef.current.contains(e.target))
        setShowAvatarMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const nameParts = (user?.name || "").split(" ");
  const [profile, setProfile] = useState({
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" ") || "",
    phone: user?.phone || "",
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
  });

  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

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
  const handleCameraCapture = async (dataUrl) => { setAvatarUrl(dataUrl); await uploadAvatar(dataUrl); };
  const handleRemoveAvatar = async () => {
    setAvatarUrl(null); setShowAvatarMenu(false);
    try { const res = await userService.updateProfile({ avatar: null }); updateUser(res.data.user); toast.success("Profile photo removed"); }
    catch { toast.error("Failed to remove photo"); }
  };
  const uploadAvatar = async (dataUrl) => {
    try { const res = await userService.updateProfile({ avatar: dataUrl }); updateUser(res?.data?.user || res?.data?.data || res?.data); toast.success("Profile photo updated"); }
    catch { toast.error("Failed to upload photo"); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await userService.updateProfile({ ...profile, name: `${profile.firstName} ${profile.lastName}`.trim() });
      updateUser(res.data.user); toast.success("Profile updated successfully");
    } catch { toast.error("Failed to update profile"); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      await userService.changePassword({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      toast.success("Password changed successfully");
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) { toast.error(err.response?.data?.message || "Password change failed"); }
    finally { setLoading(false); }
  };

  const handleForgotPassword = (e) => { e.preventDefault(); e.stopPropagation(); navigate("/forgot-password"); };

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: "none" }} />
      <AnimatePresence>
        {showCameraModal && <CameraModal onCapture={handleCameraCapture} onClose={() => setShowCameraModal(false)} />}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout">

        {/* ── Top Tab Navbar ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: "4px",
          marginBottom: "var(--s-8)",
          borderBottom: "2px solid var(--border-light)",
          paddingBottom: "0",
        }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 18px",
                  border: "none",
                  borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                  marginBottom: "-2px",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "var(--primary)" : "var(--text-dim)",
                  borderRadius: "0",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <AnimatePresence mode="wait">

          {/* ── General Info ── */}
          {activeTab === "profile" && (
            <motion.div key="profile" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <Card title="Basic Profile" subtitle="Update your account information and preferences.">
                <form onSubmit={handleUpdateProfile} className="flex-col gap-6">

                  {/* Avatar + User Summary */}
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", paddingBottom: "var(--s-6)", borderBottom: "1px solid var(--border-light)" }}>
                    <div ref={avatarMenuRef} style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{ width: "72px", height: "72px", borderRadius: "50%", border: "2px solid #4F7CFF", overflow: "hidden", background: avatarUrl ? "transparent" : getAvatarColor(user?.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "1.2rem" }}>
                        {avatarUrl ? <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : getInitials(user?.name)}
                      </div>
                      <button type="button" ref={cameraButtonRef} onClick={() => setShowAvatarMenu((v) => !v)}
                        style={{ position: "absolute", bottom: "-2px", right: "-2px", width: "24px", height: "24px", borderRadius: "50%", border: "2px solid white", background: "#4F46E5", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Camera size={12} />
                      </button>
                      <AnimatePresence>
                        {showAvatarMenu && (
                          <AvatarUploadMenu
                            anchorRef={cameraButtonRef} hasAvatar={!!avatarUrl}
                            onUpload={() => { setShowAvatarMenu(false); setTimeout(() => fileInputRef.current?.click(), 150); }}
                            onCamera={() => { setShowAvatarMenu(false); setTimeout(() => setShowCameraModal(true), 150); }}
                            onRemove={handleRemoveAvatar}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text-main)" }}>{user?.name}</span>
                        <Badge style={{ background: "#EEF2FF", color: "#4F46E5", fontSize: "10px", padding: "3px 8px", borderRadius: "999px" }}>
                          {user?.role?.toUpperCase()}
                        </Badge>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "var(--text-dim)", fontSize: "0.85rem" }}>
                        <Mail size={13} />{user?.email}
                      </div>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="form-grid-2">
                    <Input label="First Name" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} />
                    <Input label="Last Name" value={profile.lastName} onChange={(e) => setProfile({ ...profile, lastName: e.target.value })} />
                    <Input label="Designation" value={profile.designation} onChange={(e) => setProfile({ ...profile, designation: e.target.value })} />
                    <Input label="Phone Number" placeholder="+1 (555) 000-0000" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                    <div className="input-group">
                      <label className="input-label">Preferred Contact</label>
                      <select className="input" value={profile.preferredContact} onChange={(e) => setProfile({ ...profile, preferredContact: e.target.value })}>
                        <option value="email">Email Address</option>
                        <option value="phone">Phone Call</option>
                        <option value="slack">Slack Message</option>
                      </select>
                    </div>
                  </div>

                  {/* Work Location */}
                  <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: "var(--s-6)" }}>
                    <h4 style={{ marginBottom: "var(--s-4)", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--primary)" }}>
                      Work Location
                    </h4>
                    <div className="flex-col gap-4">
                      <div className="form-grid-2">
                        <Input label={<>Address 1 <span style={{ color: "var(--danger)" }}>*</span></>} placeholder="Street address, P.O. box" value={profile.location.address1} onChange={(e) => setProfile({ ...profile, location: { ...profile.location, address1: e.target.value } })} />
                        <Input label={<>Address 2 <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>(Optional)</span></>} placeholder="Apartment, suite, unit, building, floor, etc." value={profile.location.address2} onChange={(e) => setProfile({ ...profile, location: { ...profile.location, address2: e.target.value } })} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "var(--s-4)" }}>
                        <Input label={<>City <span style={{ color: "var(--danger)" }}>*</span></>} placeholder="City" value={profile.location.city} onChange={(e) => setProfile({ ...profile, location: { ...profile.location, city: e.target.value } })} />
                        <div className="input-group">
                          <label className="input-label">District <span style={{ color: "var(--danger)" }}>*</span></label>
                          <select className="input" value={profile.location.district} onChange={(e) => setProfile({ ...profile, location: { ...profile.location, district: e.target.value } })}>
                            <option value="">Select District</option>
                            <option value="Chennai">Chennai</option>
                            <option value="Coimbatore">Coimbatore</option>
                            <option value="Madurai">Madurai</option>
                            <option value="Salem">Salem</option>
                            <option value="Trichy">Trichy</option>
                            <option value="Bengaluru Urban">Bengaluru Urban</option>
                            <option value="Mumbai City">Mumbai City</option>
                            <option value="Hyderabad">Hyderabad</option>
                            <option value="Pune">Pune</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>
                        <div className="input-group">
                          <label className="input-label">State <span style={{ color: "var(--danger)" }}>*</span></label>
                          <select className="input" value={profile.location.state} onChange={(e) => setProfile({ ...profile, location: { ...profile.location, state: e.target.value } })}>
                            <option value="">Select State</option>
                            {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <Input label={<>Pincode <span style={{ color: "var(--danger)" }}>*</span></>} placeholder="6-digit code" maxLength={6} value={profile.location.pincode} onChange={(e) => setProfile({ ...profile, location: { ...profile.location, pincode: e.target.value.replace(/\D/g, "") } })} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--s-4)" }}>
                    <Button type="submit" isLoading={loading}>Save Updates</Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}

          {/* ── Security & Auth ── */}
          {activeTab === "security" && (
  <motion.div
    key="security"
    initial={{ opacity: 0, x: 16 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -16 }}
  >
    {/* Change Password */}
    <Card
      title="Change Password"
      subtitle="Update your account password regularly to keep your account secure."
      style={{
        marginBottom: "24px",
      }}
    >
      <div className="flex-col gap-5">
        <Input
          type="password"
          label="Current Password"
          placeholder="••••••••"
          value={passwords.currentPassword}
          onChange={(e) =>
            setPasswords({
              ...passwords,
              currentPassword: e.target.value,
            })
          }
        />

        <div className="form-grid-2">
          <Input
            type="password"
            label="New Password"
            placeholder="••••••••"
            value={passwords.newPassword}
            onChange={(e) =>
              setPasswords({
                ...passwords,
                newPassword: e.target.value,
              })
            }
          />

          <Input
            type="password"
            label="Confirm Password"
            placeholder="••••••••"
            value={passwords.confirmPassword}
            onChange={(e) =>
              setPasswords({
                ...passwords,
                confirmPassword: e.target.value,
              })
            }
          />
        </div>

        {/* Password Strength */}
        <div>
          <div
            style={{
              height: "8px",
              borderRadius: "999px",
              background: "#E5E7EB",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width:
                  passwords.newPassword.length < 4
                    ? "25%"
                    : passwords.newPassword.length < 8
                    ? "50%"
                    : "100%",
                height: "100%",
                background:
                  passwords.newPassword.length < 4
                    ? "#EF4444"
                    : passwords.newPassword.length < 8
                    ? "#F59E0B"
                    : "#10B981",
                transition: "0.3s",
              }}
            />
          </div>

          <small
            style={{
              color: "var(--text-dim)",
              marginTop: "6px",
              display: "block",
            }}
          >
            Use at least 8 characters including numbers and symbols.
          </small>
        </div>

        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
          }}
        >
          <Button
            onClick={handleChangePassword}
            isLoading={loading}
            leftIcon={<Key size={16} />}
          >
            Update Password
          </Button>

          <button
            onClick={handleForgotPassword}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </Card>

    {/* Security Cards */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
      }}
    >
      {/* 2FA */}
      <Card>
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "14px",
              background: "#DBEAFE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={24} color="#2563EB" />
          </div>

          <div style={{ flex: 1 }}>
            <h3
              style={{
                marginBottom: "8px",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              Two-Factor Authentication
            </h3>

            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.9rem",
                marginBottom: "16px",
              }}
            >
              Add an extra layer of security by requiring a verification code.
            </p>

            <Button variant="outline">
              Configure 2FA →
            </Button>
          </div>
        </div>
      </Card>

      {/* Sessions */}
      <Card>
        <div
          style={{
            display: "flex",
            gap: "16px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "14px",
              background: "#FCE7F3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Monitor size={24} color="#DB2777" />
          </div>

          <div style={{ flex: 1 }}>
            <h3
              style={{
                marginBottom: "8px",
                fontSize: "1rem",
                fontWeight: 700,
              }}
            >
              Active Sessions
            </h3>

            <p
              style={{
                color: "var(--text-dim)",
                fontSize: "0.9rem",
                marginBottom: "16px",
              }}
            >
              You are currently logged in on 3 devices.
            </p>

            <Button variant="outline">
              View Sessions →
            </Button>
          </div>
        </div>
      </Card>
    </div>

    {/* Danger Zone */}
    <Card
      style={{
        marginTop: "24px",
        border: "1px solid #FECACA",
        background: "#FEF2F2",
      }}
    >
      <div className="flex-between">
        <div>
          <h3
            style={{
              color: "#DC2626",
              marginBottom: "6px",
            }}
          >
            Deactivate Account
          </h3>

          <p
            style={{
              color: "#7F1D1D",
              fontSize: "0.9rem",
            }}
          >
            Permanently remove your access to the portal.
          </p>
        </div>

        <Button
          variant="danger"
          onClick={() => {
            if (
              window.confirm(
                "Are you sure you want to deactivate your account?"
              )
            ) {
              toast.warning(
                "Account deactivation requires administrator approval."
              );
            }
          }}
        >
          Deactivate
        </Button>
      </div>
    </Card>
  </motion.div>
)}

          {/* ── Notifications ── */}
          {activeTab === "notifications" && (
            <motion.div key="notifications" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}>
              <Card title="Communication Preferences" subtitle="Manage how and when you receive updates about your tickets.">
                <div className="flex-col gap-6">
                  {[
                    { id: "email",    label: "Email Notifications", desc: "Receive status updates and replies via email." },
                    { id: "inApp",    label: "In-App Alerts",        desc: "Show real-time toast notifications in the portal." },
                    { id: "onAssign", label: "Assignment Alerts",    desc: "Notify me when I am assigned to a ticket." },
                    { id: "onComment",label: "Comment Alerts",       desc: "Notify me when someone comments on my tickets." },
                  ].map((pref) => (
                    <div key={pref.id} className="flex-between" style={{ padding: "16px 20px", background: "var(--surface-alt)", borderRadius: "16px", border: "1px solid var(--border)" }}>
                      <div className="flex-col">
                        <span style={{ fontWeight: 800, color: "var(--text-main)" }}>{pref.label}</span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{pref.desc}</span>
                      </div>
                      <div
                        onClick={async () => {
                          const newPrefs = { ...user.notificationPreferences, [pref.id]: !user.notificationPreferences?.[pref.id] };
                          try { const res = await userService.updateProfile({ notificationPreferences: newPrefs }); updateUser(res.data.user); toast.success(`${pref.label} updated`); }
                          catch { toast.error("Failed to update preference"); }
                        }}
                        style={{ width: "44px", height: "24px", background: user.notificationPreferences?.[pref.id] ? "var(--primary)" : "var(--border)", borderRadius: "20px", padding: "4px", cursor: "pointer", display: "flex", justifyContent: user.notificationPreferences?.[pref.id] ? "flex-end" : "flex-start", transition: "all 0.2s ease" }}
                      >
                        <motion.div layout style={{ width: "16px", height: "16px", background: "white", borderRadius: "50%", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </>
  );
}