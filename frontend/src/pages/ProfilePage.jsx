import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  User,
  Mail,
  Bell,
  Shield,
  Key,
  Camera,
  LogOut,
  Upload,
  X,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { userService } from "../services/ticketService";
import { getInitials, getAvatarColor } from "../utils/helpers";
import { Card, Button, Input, Badge } from "../ui";
import { motion, AnimatePresence } from "framer-motion";


// ─── Menu item base style ────────────────────────────────────────────────────
const menuItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
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

// ─── Avatar Upload Dropdown (portal) ─────────────────────────────────────────
function AvatarUploadMenu({
  anchorRef,
  hasAvatar,
  onUpload,
  onCamera,
  onRemove,
}) {
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
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--surface-alt)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Upload size={16} />
        <span>Upload from computer</span>
      </button>

      <button
        onClick={onCamera}
        style={menuItemStyle}
        onMouseEnter={(e) =>
          (e.currentTarget.style.background = "var(--surface-alt)")
        }
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <Camera size={16} />
        <span>Take a photo</span>
      </button>

      {hasAvatar && (
        <button
          onClick={onRemove}
          style={{ ...menuItemStyle, color: "var(--danger)" }}
        >
          <X size={16} />
          <span>Remove photo</span>
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
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
        };
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Camera access denied. Please allow camera permission.",
      );
    }
  };

  const stopCamera = () => stream?.getTracks().forEach((t) => t.stop());

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    setCaptured(canvas.toDataURL("image/jpeg", 0.9));
    stopCamera();
  };

  const handleRetake = () => {
    setCaptured(null);
    startCamera();
  };

  const handleUse = () => {
    onCapture(captured);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{
          background: "white",
          borderRadius: "20px",
          padding: "24px",
          width: "100%",
          maxWidth: "480px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h3 style={{ fontWeight: 700, fontSize: "1.1rem", margin: 0 }}>
            Take a Photo
          </h3>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            style={{
              border: "none",
              background: "var(--surface-alt)",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {error ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              color: "var(--text-dim)",
            }}
          >
            <Camera size={40} style={{ marginBottom: "12px", opacity: 0.4 }} />
            <p style={{ fontSize: "0.9rem" }}>{error}</p>
          </div>
        ) : (
          <>
            <div
              style={{
                borderRadius: "14px",
                overflow: "hidden",
                background: "#000",
                aspectRatio: "4/3",
              }}
            >
              {!captured ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: "scaleX(-1)",
                  }}
                />
              ) : (
                <img
                  src={captured}
                  alt="Captured"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              )}
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />

            <div
              style={{
                display: "flex",
                gap: "12px",
                marginTop: "16px",
                justifyContent: "center",
              }}
            >
              {!captured ? (
                <button
                  onClick={handleCapture}
                  style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    border: "4px solid var(--primary)",
                    background: "white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                    transition: "transform 0.1s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "scale(1.05)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "scale(1)")
                  }
                >
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "50%",
                      background: "var(--primary)",
                    }}
                  />
                </button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    leftIcon={<RotateCcw size={16} />}
                    onClick={handleRetake}
                  >
                    Retake
                  </Button>
                  <Button
                    onClick={handleUse}
                    leftIcon={<CheckCircle2 size={16} />}
                  >
                    Use Photo
                  </Button>
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
  const { user, updateUser, logout } = useAuth();
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

  // Close dropdown on outside click — but ignore clicks inside the portal menu
  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest("[data-avatar-menu]")) return;
      if (
        avatarMenuRef.current &&
        !avatarMenuRef.current.contains(e.target) &&
        cameraButtonRef.current &&
        !cameraButtonRef.current.contains(e.target)
      ) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const [profile, setProfile] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
    designation: user?.designation || "",
    preferredContact: user?.preferredContact || "email",
    location: {
      floor: user?.location?.floor || "",
      branch: user?.location?.branch || "",
      city: user?.location?.city || "",
    },
  });

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // ── Avatar handlers ──────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      setAvatarUrl(dataUrl);
      try {
        await uploadAvatar(dataUrl);
      } catch (err) {
        console.error(err);
        toast.error("Upload failed");
      }
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
      updateUser(res.data.user);
      toast.success("Profile photo removed");
    } catch {
      toast.error("Failed to remove photo");
    }
  };

  const uploadAvatar = async (dataUrl) => {
    try {
      const res = await userService.updateProfile({ avatar: dataUrl });
      const updatedUser = res?.data?.user || res?.data?.data || res?.data;
      updateUser(updatedUser);
      toast.success("Profile photo updated");
    } catch {
      toast.error("Failed to upload photo");
    }
  };

  // ── Form handlers ────────────────────────────────────────────────────────
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await userService.updateProfile(profile);
      updateUser(res.data.user);
      toast.success("Profile updated successfully");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword)
      return toast.error("Passwords do not match");
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

  // ── Forgot Password handler — defined outside any form ───────────────────
  const handleForgotPassword = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate("/forgot-password");
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* Camera modal */}
      <AnimatePresence>
        {showCameraModal && (
          <CameraModal
            onCapture={handleCameraCapture}
            onClose={() => setShowCameraModal(false)}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-layout"
      >
        {/* ── Profile Header Card ── */}
        <Card
          style={{
            marginBottom: "var(--s-8)",
            background: "linear-gradient(to right, #F8FAFC, #FFFFFF)",
          }}
        >
          <div className="flex-center gap-8" style={{ padding: "var(--s-4)" }}>
            {/* Avatar */}
            <div
              ref={avatarMenuRef}
              style={{ position: "relative", flexShrink: 0 }}
            >
              {/* Gradient ring */}
              <div
                style={{
                  padding: "3px",
                  borderRadius: "50%",
                  background: avatarUrl
                    ? "linear-gradient(135deg, var(--primary) 0%, #a78bfa 50%, #38bdf8 100%)"
                    : "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
                  boxShadow: avatarUrl
                    ? "0 0 0 2px white, 0 4px 16px rgba(99,102,241,0.25)"
                    : "0 0 0 2px white",
                  transition: "background 0.4s",
                }}
              >
                <div
                  className="flex-center"
                  style={{
                    width: "96px",
                    height: "96px",
                    background: avatarUrl
                      ? "transparent"
                      : getAvatarColor(user?.name),
                    borderRadius: "50%",
                    overflow: "hidden",
                    color: "white",
                    fontSize: "2.2rem",
                    fontWeight: 800,
                  }}
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    getInitials(user?.name)
                  )}
                </div>
              </div>

              {/* Camera button */}
              <button
                ref={cameraButtonRef}
                className="flex-center"
                onClick={() => setShowAvatarMenu((v) => !v)}
                style={{
                  position: "absolute",
                  bottom: "2px",
                  right: "2px",
                  width: "30px",
                  height: "30px",
                  background: showAvatarMenu ? "var(--primary)" : "white",
                  color: showAvatarMenu ? "white" : "var(--text-muted)",
                  borderRadius: "50%",
                  border: "2px solid white",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  zIndex: 1,
                }}
              >
                <Camera size={15} />
              </button>

              {/* Portal dropdown */}
              <AnimatePresence>
                {showAvatarMenu && (
                  <AvatarUploadMenu
                    anchorRef={cameraButtonRef}
                    hasAvatar={!!avatarUrl}
                    onUpload={() => {
                      setShowAvatarMenu(false);
                      setTimeout(() => fileInputRef.current?.click(), 150);
                    }}
                    onCamera={() => {
                      setShowAvatarMenu(false);
                      setTimeout(() => setShowCameraModal(true), 150);
                    }}
                    onRemove={handleRemoveAvatar}
                    onClose={() => setShowAvatarMenu(false)}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* User info */}
            <div className="flex-1">
              <div className="flex-center gap-3 mb-1">
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>
                  {user?.name}
                </h1>
                <Badge variant="primary">{user?.role?.replace("_", " ")}</Badge>
              </div>
              <p
                style={{
                  color: "var(--text-dim)",
                  marginBottom: "var(--s-4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Mail size={16} /> {user?.email}
              </p>
              <div className="flex-center gap-6">
                <div className="flex-center gap-2">
                  <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                    {user?.stats?.totalRaised || 0}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    Tickets Raised
                  </span>
                </div>
                <div className="flex-center gap-2">
                  <span style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                    {user?.stats?.totalResolved || 0}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
                    Resolved
                  </span>
                </div>
              </div>
            </div>

            <Button variant="outline">View Public Profile</Button>
          </div>
        </Card>

        {/* ── Body ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            gap: "var(--s-8)",
          }}
        >
          {/* Sidebar */}
          <div className="flex-col gap-2">
            {[
              { id: "profile", label: "General info", icon: User },
              { id: "security", label: "Security & Auth", icon: Shield },
              { id: "notifications", label: "Notifications", icon: Bell },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`premium-nav-item ${activeTab === tab.id ? "active" : ""}`}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            ))}
            <div
              style={{
                marginTop: "var(--s-4)",
                paddingTop: "var(--s-4)",
                borderTop: "1px solid var(--border-light)",
              }}
            >
              <button
                onClick={logout}
                className="premium-nav-item"
                style={{
                  color: "var(--danger)",
                  width: "100%",
                  justifyContent: "flex-start",
                }}
              >
                <LogOut size={18} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-col gap-8">
            <AnimatePresence mode="wait">

              {/* ── General Info ── */}
              {activeTab === "profile" && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card
                    title="Personal Information"
                    subtitle="Update your basic profile details here."
                  >
                    <form onSubmit={handleUpdateProfile} className="flex-col gap-6">
                      <div className="form-grid-2">
                        <Input
                          label="Full Name"
                          value={profile.name}
                          onChange={(e) =>
                            setProfile({ ...profile, name: e.target.value })
                          }
                        />
                        <Input
                          label="Designation"
                          value={profile.designation}
                          onChange={(e) =>
                            setProfile({ ...profile, designation: e.target.value })
                          }
                        />
                        <Input
                          label="Phone Number"
                          value={profile.phone}
                          onChange={(e) =>
                            setProfile({ ...profile, phone: e.target.value })
                          }
                        />
                        <div className="input-group">
                          <label className="input-label">Preferred Contact</label>
                          <select
                            className="input"
                            value={profile.preferredContact}
                            onChange={(e) =>
                              setProfile({ ...profile, preferredContact: e.target.value })
                            }
                          >
                            <option value="email">Email Address</option>
                            <option value="phone">Phone Call</option>
                            <option value="slack">Slack Message</option>
                          </select>
                        </div>
                      </div>

                      <div
                        style={{
                          borderTop: "1px solid var(--border-light)",
                          paddingTop: "var(--s-6)",
                        }}
                      >
                        <h4 style={{ marginBottom: "var(--s-4)", fontSize: "0.9rem" }}>
                          Work Location
                        </h4>
                        <div className="form-grid-3">
                          <Input
                            label="Floor"
                            value={profile.location.floor}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                location: { ...profile.location, floor: e.target.value },
                              })
                            }
                          />
                          <Input
                            label="Branch"
                            value={profile.location.branch}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                location: { ...profile.location, branch: e.target.value },
                              })
                            }
                          />
                          <Input
                            label="City"
                            value={profile.location.city}
                            onChange={(e) =>
                              setProfile({
                                ...profile,
                                location: { ...profile.location, city: e.target.value },
                              })
                            }
                          />
                        </div>
                      </div>

                      <div
                        className="flex-center"
                        style={{ justifyContent: "flex-end", marginTop: "var(--s-4)" }}
                      >
                        <Button type="submit" isLoading={loading}>
                          Save Updates
                        </Button>
                      </div>
                    </form>
                  </Card>
                </motion.div>
              )}

              {/* ── Security ── */}
              {activeTab === "security" && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card
                    title="Security Settings"
                    subtitle="Keep your account secure with a strong password."
                  >
                    {/* Inputs only — buttons live outside the form below */}
                    <form className="flex-col gap-6">
                      <Input
                        type="password"
                        label="Current Password"
                        placeholder="••••••••"
                        value={passwords.currentPassword}
                        onChange={(e) =>
                          setPasswords({ ...passwords, currentPassword: e.target.value })
                        }
                      />
                      <div className="form-grid-2">
                        <Input
                          type="password"
                          label="New Password"
                          placeholder="••••••••"
                          value={passwords.newPassword}
                          onChange={(e) =>
                            setPasswords({ ...passwords, newPassword: e.target.value })
                          }
                        />
                        <Input
                          type="password"
                          label="Confirm Password"
                          placeholder="••••••••"
                          value={passwords.confirmPassword}
                          onChange={(e) =>
                            setPasswords({ ...passwords, confirmPassword: e.target.value })
                          }
                        />
                      </div>

                      {/* Spacer inside form to preserve gap layout — no button here */}
                    </form>

                    {/* ✅ Both buttons outside the form, side by side */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "center",
                        gap: "12px",
                        marginTop: "var(--s-4)",
                      }}
                    >
                      <Button
                        type="button"
                        variant="outline"
                        leftIcon={<Key size={18} />}
                        onClick={handleForgotPassword}
                      >
                        Forgot Password
                      </Button>
                      <Button
                        type="button"
                        isLoading={loading}
                        leftIcon={<Key size={18} />}
                        onClick={handleChangePassword}
                      >
                        Update Password
                      </Button>
                    </div>
                  </Card>

                  <Card
                    style={{
                      marginTop: "var(--s-6)",
                      border: "1px solid #FFE4E6",
                      background: "#FFF1F2",
                    }}
                  >
                    <div className="flex-between">
                      <div>
                        <h4 style={{ color: "var(--danger)", fontWeight: 700 }}>
                          Deactivate Account
                        </h4>
                        <p style={{ fontSize: "0.8rem", color: "#991B1B" }}>
                          Permanently remove your access to the portal.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Are you sure you want to deactivate your account?",
                            )
                          ) {
                            toast.warning(
                              "Account deactivation must be approved by an administrator.",
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
                <motion.div
                  key="notifications"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  <Card
                    title="Communication Preferences"
                    subtitle="Manage how and when you receive updates about your tickets."
                  >
                    <div className="flex-col gap-6">
                      {[
                        {
                          id: "email",
                          label: "Email Notifications",
                          desc: "Receive status updates and replies via email.",
                        },
                        {
                          id: "inApp",
                          label: "In-App Alerts",
                          desc: "Show real-time toast notifications in the portal.",
                        },
                        {
                          id: "onAssign",
                          label: "Assignment Alerts",
                          desc: "Notify me when I am assigned to a ticket.",
                        },
                        {
                          id: "onComment",
                          label: "Comment Alerts",
                          desc: "Notify me when someone comments on my tickets.",
                        },
                      ].map((pref) => (
                        <div
                          key={pref.id}
                          className="flex-between"
                          style={{
                            padding: "16px 20px",
                            background: "var(--surface-alt)",
                            borderRadius: "16px",
                            border: "1px solid var(--border)",
                          }}
                        >
                          <div className="flex-col">
                            <span style={{ fontWeight: 800, color: "var(--text-main)" }}>
                              {pref.label}
                            </span>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
                              {pref.desc}
                            </span>
                          </div>
                          <div
                            onClick={async () => {
                              const newPrefs = {
                                ...user.notificationPreferences,
                                [pref.id]: !user.notificationPreferences?.[pref.id],
                              };
                              try {
                                const res = await userService.updateProfile({
                                  notificationPreferences: newPrefs,
                                });
                                updateUser(res.data.user);
                                toast.success(`${pref.label} updated`);
                              } catch {
                                toast.error("Failed to update preference");
                              }
                            }}
                            style={{
                              width: "44px",
                              height: "24px",
                              background: user.notificationPreferences?.[pref.id]
                                ? "var(--primary)"
                                : "var(--border)",
                              borderRadius: "20px",
                              padding: "4px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: user.notificationPreferences?.[pref.id]
                                ? "flex-end"
                                : "flex-start",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <motion.div
                              layout
                              style={{
                                width: "16px",
                                height: "16px",
                                background: "white",
                                borderRadius: "50%",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  );
}