import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Bell, 
  Eye, 
  Terminal, 
  Save, 
  Smartphone, 
  Database,
  LogOut,
  Moon,
  Globe,
  Clock3,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { userService, settingsService } from '../services/ticketService';
import { Button, Card, Input, Badge } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from "../context/ThemeContext";

export default function SettingsPage() {
  const { user, logout, updateUser } = useAuth();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState(isAdmin ? 'sla' : 'security');
  const [loading, setLoading] = useState(false);
  const [slaHours, setSlaHours] = useState({
    critical: 1,
    high: 4,
    medium: 26,
    low: 72
  });
  const [savingSla, setSavingSla] = useState(false);

  React.useEffect(() => {
    if (isAdmin) {
      fetchSettings();
    }
  }, [isAdmin]);

  const fetchSettings = async () => {
    try {
      const res = await settingsService.getAll();
      const slaSetting = res.data.settings.find(s => s.key === 'SLA_HOURS');
      if (slaSetting) {
        setSlaHours(slaSetting.value);
      }
    } catch (err) {
      console.error('Failed to fetch settings');
    }
  };

  const handleUpdateSla = async () => {
    setSavingSla(true);
    try {
      await settingsService.update({
        key: 'SLA_HOURS',
        value: slaHours,
        description: 'SLA resolution time targets in hours'
      });
      toast.success('SLA targets updated successfully');
    } catch (err) {
      toast.error('Failed to update SLA targets');
    } finally {
      setSavingSla(false);
    }
  };


  

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [notifPrefs, setNotifPrefs] = useState(user?.notificationPreferences || {
    email: true,
    inApp: true,
    onAssign: true,
    onComment: true,
    slaAlerts: isAdmin
  });

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    setLoading(true);
    try {
      await userService.changePassword({
        currentPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword
      });
      console.log('Password change response:',passwordForm.oldPassword, passwordForm.newPassword);
      toast.success('Security credentials updated');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePref = async (key) => {
    const updated = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(updated);
    try {
      const res = await userService.updateProfile({ notificationPreferences: updated });
      updateUser(res.data.user);
      toast.success('Preferences synced');
    } catch (err) {
      toast.error('Sync failed');
    }
  };

  const tabs = [
    { id: 'profile', label: 'General Info', icon: User },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'notifications', label: 'Communication', icon: Bell },
    { id: 'appearance', label: 'Theme & UX', icon: Eye },
    ...(isAdmin ? [
      { id: 'admin_header', label: 'Admin Controls', isHeader: true },
      { id: 'sla', label: 'SLA Management', icon: Clock3 },
      { id: 'system', label: 'Infrastructure', icon: Terminal }
    ] : [])
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="page-layout">
      <div className="flex-between mb-8">
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.02em' }}>Settings</h1>
          <p style={{ color: 'var(--text-dim)' }}>Manage your personal preferences and system-wide configurations.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '48px' }}>
        <div className="flex-col gap-2">
          {tabs.map(tab => {
            if (tab.isHeader) {
              return (
                <div key={tab.id} style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '24px', marginBottom: '8px', paddingLeft: '12px' }}>
                  {tab.label}
                </div>
              );
            }
            return (
              <button
                key={tab.id}
                onClick={() => {
                    if (tab.id === "profile") {
                       navigate("/profile");
                       return;
                    }

                  setActiveTab(tab.id);
            }}
                className={`premium-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                style={{ justifyContent: 'flex-start', padding: '12px 16px' }}
              >
                <tab.icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Panels */}
        <div className="flex-col gap-6">
          <AnimatePresence mode="wait">
            {activeTab === 'security' && (
              <motion.div key="security" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-col gap-6">
                <Card title="Password Safeguard" subtitle="Change your password regularly to maintain account integrity.">
                  <form onSubmit={handlePasswordUpdate} className="flex-col gap-4">
                    <Input type="password" label="Current Password" value={passwordForm.oldPassword} onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})} />
                    <div className="form-grid-2">
                      <Input type="password" label="New Password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
                      <Input type="password" label="Confirm Password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} />
                    </div>
                    <div className="flex-end">
                      <Button type="submit" isLoading={loading} leftIcon={<Save size={18} />}>Update Security</Button>
                    </div>
                  </form>
                </Card>

                <Card title="Identity Protection">
                   <div className="flex-between" style={{ background: 'var(--surface-alt)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                         <Smartphone size={24} color="var(--primary)" />
                         <div>
                            <div style={{ fontWeight: 800 }}>Mobile 2FA Authentication</div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>Require a code from your phone to login.</p>
                         </div>
                      </div>
                      <Button variant="outline" size="sm">Configure</Button>
                   </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div key="notifications" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Card title="Communication Hub" subtitle="Define when we should reach out to you via external channels.">
                  <div className="flex-col gap-2">
                     {[
                       { id: 'email', label: 'Email Correspondence', desc: 'Detailed status reports and PDF exports via email.' },
                       { id: 'inApp', label: 'Platform Toast Alerts', desc: 'Real-time floating alerts while using the portal.' },
                       { id: 'onAssign', label: 'Assignment Pushed', desc: 'Alerts when a task is delegated to your queue.' },
                       { id: 'onComment', label: 'Mention & Replies', desc: 'Notifications for communication in the ticket thread.' },
                     ].map(pref => (
                       <div key={pref.id} className="flex-between" style={{ padding: '20px', borderBottom: '1px solid var(--border-light)' }}>
                          <div>
                             <div style={{ fontWeight: 800 }}>{pref.label}</div>
                             <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '4px' }}>{pref.desc}</p>
                          </div>
                          <div 
                            onClick={() => handleTogglePref(pref.id)}
                            style={{ 
                              width: '48px', height: '24px', background: notifPrefs[pref.id] ? 'var(--primary)' : '#CBD5E1', 
                              borderRadius: '12px', position: 'relative', cursor: 'pointer', transition: '0.2s' 
                            }}
                          >
                             <motion.div 
                               animate={{ x: notifPrefs[pref.id] ? 26 : 4 }}
                               style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px' }} 
                             />
                          </div>
                       </div>
                     ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'appearance' && (
               <motion.div key="appearance" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                 <Card title="Visual Experience">
                    <div className="form-grid-2">
                       <div onClick={() => toggleTheme("light")}
                            className="p-6 cursor-pointer"
                            style={{border:theme === "light"? "2px solid var(--primary)": "1px solid var(--border)",borderRadius: "16px",background: "white",transition: "0.3s",cursor: "pointer",}}>
                          <div style={{ height: '40px', width: '60px', background: '#F1F5F9', borderRadius: '4px', marginBottom: '12px' }} />
                          <div style={{ fontWeight: 800 }}>System Default</div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Matches your device settings.</p>
                       </div>
                       <div className="p-6 cursor-pointer" style={{ border: '1px solid var(--border)', borderRadius: '16px', background: '#0F172A', color: 'white' }}>
                          <div style={{ height: '40px', width: '60px', background: '#1E293B', borderRadius: '4px', marginBottom: '12px' }} />
                          <div
  onClick={() => toggleTheme("dark")}
  className="p-6 cursor-pointer"
  style={{
    border:
      theme === "dark"
        ? "2px solid var(--primary)"
        : "1px solid var(--border)",
        borderRadius: "16px",background: "#0F172A",color: "white",transition: "0.3s",cursor: "pointer",}}></div>
                          <p style={{ fontSize: '0.75rem', opacity: 0.7 }}>Optimized for low-light environments.</p>
                       </div>
                    </div>
                    <div style={{ marginTop: '24px' }}>
                       <label className="input-label">Regional Language</label>
                       <select className="input">
                          <option>English (United States)</option>
                          <option>English (United Kingdom)</option>
                          <option>Español</option>
                          <option>Français</option>
                       </select>
                    </div>
                 </Card>
               </motion.div>
            )}

            {activeTab === 'sla' && isAdmin && (
              <motion.div key="sla" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-col gap-6">
                 <div style={{ background: '#F1F5F9', padding: '16px 24px', borderRadius: '16px', borderLeft: '4px solid var(--primary)', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Super Admin Override</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)', marginTop: '4px' }}>Manual SLA Resolution Targets</div>
                 </div>
                 <Card title="Priority Response Config" subtitle="Manually adjust the target resolution hours for each priority level. These values override system defaults for all new tickets.">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                       {Object.entries(slaHours).map(([priority, hours]) => (
                         <div key={priority} className="flex-col gap-2">
                            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                               {priority} Priority
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                               <Input 
                                 type="number" 
                                 value={hours} 
                                 onChange={e => setSlaHours({...slaHours, [priority]: parseInt(e.target.value) || 0})}
                                 style={{ marginBottom: 0 }}
                               />
                               <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 600 }}>Hrs</span>
                            </div>
                         </div>
                       ))}
                    </div>
                    <div className="flex-end">
                       <Button onClick={handleUpdateSla} isLoading={savingSla} leftIcon={<Save size={18} />}>Save SLA Targets</Button>
                    </div>
                 </Card>
              </motion.div>
            )}

            {activeTab === 'system' && isAdmin && (
              <motion.div key="system" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-col gap-6">
                 <Card title="Infrastructure Control">
                    <div className="form-grid-2">
                       <div style={{ padding: '20px', background: '#F8FAFC', borderRadius: '16px', border: '1px solid var(--border)' }}>
                          <Database size={20} color="var(--primary)" style={{ marginBottom: '12px' }} />
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>Diagnostic Health</div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Analyze database latency and CPU load.</p>
                          <Button size="sm" variant="outline" style={{ marginTop: '16px', width: '100%' }}>Run Health Check</Button>
                       </div>
                       <div style={{ padding: '20px', background: '#F8FAFC', borderRadius: '16px', border: '1px solid var(--border)' }}>
                          <Terminal size={20} color="var(--primary)" style={{ marginBottom: '12px' }} />
                          <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>API Sync Monitor</div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '4px' }}>Verify external integration status.</p>
                          <Button size="sm" variant="outline" style={{ marginTop: '16px', width: '100%' }}>View Logs</Button>
                       </div>
                    </div>
                 </Card>

                 <Card style={{ borderColor: '#FCA5A5', background: '#FEF2F2' }}>
                    <div className="flex-between">
                       <div>
                          <div style={{ fontWeight: 800, color: '#991B1B' }}>Developer Mode</div>
                          <p style={{ fontSize: '0.8rem', color: '#B91C1C', marginTop: '4px' }}>Enable verbose logs and staging environment metrics.</p>
                       </div>
                       <div style={{ width: '48px', height: '24px', background: '#EF4444', borderRadius: '12px', display: 'flex', justifyContent: 'flex-end', padding: '3px' }}>
                          <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%' }} />
                       </div>
                    </div>
                 </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
