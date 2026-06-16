import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useOtpTimer } from '../hooks/useOtpTimer';
import Logo from '../assets/logo.png';

// ─────────────────────────────────────────────────────────────────────────────
// Inline OtpInput — self-contained, no prop-threading issues
// Supports: keyboard nav, paste-anywhere, mobile SMS autocomplete
// Does NOT auto-submit on complete — parent drives submission via button
// ─────────────────────────────────────────────────────────────────────────────
function OtpInput({ value, onChange, disabled }) {
  const inputRefs = useRef([]);

  // Focus helper
  const focusCell = (index) => {
    const el = inputRefs.current[index];
    if (el) {
      el.focus();
      // Move caret to end so typing replaces rather than inserts
      requestAnimationFrame(() => el.setSelectionRange(1, 1));
    }
  };

  // Single-cell change
  const handleChange = (index, e) => {
    const raw = e.target.value;
    // Accept only digits; strip everything else
    const digit = raw.replace(/\D/g, '').slice(-1);

    const next = [...value];
    next[index] = digit;
    onChange(next);

    if (digit && index < 5) focusCell(index + 1);
  };

  // Backspace navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (value[index]) {
        // Clear current cell
        const next = [...value];
        next[index] = '';
        onChange(next);
      } else if (index > 0) {
        // Move back and clear
        const next = [...value];
        next[index - 1] = '';
        onChange(next);
        focusCell(index - 1);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      focusCell(index - 1);
    } else if (e.key === 'ArrowRight' && index < 5) {
      focusCell(index + 1);
    }
  };

  // Paste on any cell — fills all 6
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    onChange(next);

    // Focus last filled cell (or last cell if full)
    const lastFilled = Math.min(pasted.length, 5);
    focusCell(lastFilled);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'center',
        // Paste anywhere in the container works because it bubbles
      }}
      onPaste={handlePaste}
    >
      {value.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="text"
          inputMode="numeric"
          // ✅ Critical for mobile SMS autofill — browser reads this attribute
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={digit}
          disabled={disabled}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          style={{
            width: '48px',
            height: '56px',
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            border: digit
              ? '2px solid #1F4E79'
              : '2px solid #E5E7EB',
            borderRadius: '12px',
            outline: 'none',
            background: disabled ? '#F9FAFB' : '#fff',
            color: '#1a1a1a',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: digit ? '0 0 0 3px rgba(31,78,121,0.08)' : 'none',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
          onFocusCapture={(e) => {
            // Highlight ring on focus
            e.target.style.borderColor = '#1F4E79';
            e.target.style.boxShadow = '0 0 0 3px rgba(31,78,121,0.15)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = digit ? '#1F4E79' : '#E5E7EB';
            e.target.style.boxShadow = digit ? '0 0 0 3px rgba(31,78,121,0.08)' : 'none';
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { loginWithToken } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [useMobile, setUseMobile] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [devOtp, setDevOtp] = useState(null); // only populated in development
  const [userType, setUserType] = useState('employee');
  // ── OTP timer hook ──────────────────────────────────────────────────────────
  const { formatted, isExpired, cooldown, onResend, isLocked } = useOtpTimer({
    expirySeconds: 300,
    resendCooldown: 30,
    maxResends: 3,
  });

  // ── Step 1 — Send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    const target = useMobile ? mobile.trim() : email.trim();
    if (!target) return toast.error(useMobile ? 'Please enter your phone number' : 'Please enter your work email');

    if (!useMobile) {
      const allowedDomains = ['@vdartinc.com', '@ndartinc.com'];
      const isValid = allowedDomains.some((d) => email.toLowerCase().endsWith(d));
      if (!isValid) {
        return toast.error('Please use a valid company email (@vdartinc.com or @ndartinc.com).');
      }
    }

    setLoading(true);
    try {
      const payload = useMobile ? { mobile } : { email };
      const res = await api.post('/auth/send-otp', payload);
      toast.success(res.data.message || 'Code sent!');
      setStep('otp');
      // Dev autofill — server returns devOtp only when NODE_ENV=development
      if (res.data.devOtp) {
        // Pad to 6 digits — leading zeros are lost if server sends a number
        const padded = String(res.data.devOtp).padStart(6, '0').slice(0, 6);
        setOtp(padded.split(''));
        setDevOtp(padded);
      } else {
        setOtp(['', '', '', '', '', '']);
      }
    } catch (err) {
      if (!err.response) {
        toast.error('Network Error: Cannot connect to the server.');
      } else {
        toast.error(err.response?.data?.message || 'Failed to send code');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ──────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!onResend()) return;
    setResending(true);
    setOtp(['', '', '', '', '', '']);
    setDevOtp(null);
    try {
      const payload = useMobile ? { mobile } : { email };
      const res = await api.post('/auth/send-otp', payload);
      toast.success(res.data.message || 'New code sent!');
      if (res.data.devOtp) {
        const padded = String(res.data.devOtp).padStart(6, '0').slice(0, 6);
        setOtp(padded.split(''));
        setDevOtp(padded);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  // ── Step 2 — Verify OTP (button-click only) ─────────────────────────────────
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return toast.error('Please enter the full 6-digit code');
    if (loading) return;

    setLoading(true);
    try {
      const payload = useMobile ? { mobile, otp: otpCode } : { email, otp: otpCode };
      const res = await api.post('/auth/verify-otp', payload);
      loginWithToken(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name || 'there'}!`);
      const role = res.data.user.role;
      navigate(['admin', 'support_agent'].includes(role) ? '/dashboard' : '/tickets');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect code. Please try again.');
      setOtp(['', '', '', '', '', '']);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="auth-page">

      {/* Branding Panel */}
      <div className="auth-page__brand">
        <div className="auth-page__logo-fixed">
          <div className="flex-center" style={{ width: '42px', height: '42px' }}>
            <img src={Logo} alt="Logo" style={{ width: '100%', height: 'auto' }} />
          </div>
          <span style={{ letterSpacing: '1.5px', fontWeight: 900, marginLeft: '10px' }}>VDESK</span>
        </div>

        <div className="auth-page__brand-content">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="auth-page__tagline">
              The support hub for<br />modern teams.
            </h1>
            <p className="auth-page__tagline-sub">
              Sign in with just your email — no password needed. We'll send you a secure code.
            </p>
            <div className="auth-page__features-pills">
              <span className="feature-pill">No password needed</span>
              <span className="feature-pill">Secure OTP login</span>
            </div>
          </motion.div>
        </div>

        <div style={{ position: 'absolute', bottom: '2rem', left: '2rem', fontSize: '0.75rem', opacity: 0.6, color: 'white' }}>
          © 2024 VDart Inc. Technical Support Division.
        </div>
      </div>

      {/* Form Panel */}
      <div className="auth-page__form-side">
        <AnimatePresence mode="sync">

          {/* Tabs */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: '32px',
            marginBottom: '48px', borderBottom: '1px solid #f3f4f6',
            width: '100%', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto',
          }}>
            {[
             { label: 'Employee', mobile: false, disabled: false },
             { label: 'Support Agent', mobile: false, disabled: false },
             { label: 'Mobile Access', mobile: true, disabled: false },
            ].map(({ label, mobile, disabled }) => {
              const active =
                (label === 'Employee' && !useMobile && userType === 'employee') ||
                (label === 'Support Agent' && !useMobile && userType === 'support_agent') ||
                (label === 'Mobile Access' && useMobile);
              return (
                <button
                  key={label}
                  onClick={disabled ? undefined : () => {
                    setUseMobile(mobile);

  if (label === 'Employee') {
    setUserType('employee');
  } else if (label === 'Support Agent') {
    setUserType('support_agent');
  }

  setStep('email');
  setOtp(['','','','','','']);
}}
                  disabled={disabled}
                  style={{
                    paddingBottom: '12px',
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontWeight: 800,
                    border: 'none',
                    background: 'transparent',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    borderBottom: active ? '2px solid #1F4E79' : '2px solid transparent',
                    color: active ? '#1F4E79' : '#9ca3af',
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Step 1 — Email */}
          {step === 'email' && !useMobile && (
            <motion.div
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ width: '100%', maxWidth: '420px' }}
            >
              <div style={{ marginBottom: 'var(--s-8)', textAlign: 'center' }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 900 }}>
                  {userType === 'support_agent'
                  ? 'Support Agent Login'
                  : 'Employee Login'}
                </h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem', lineHeight: 1.5 }}>
                    {userType === 'support_agent'
                    ? 'Sign in as a Support Agent to manage tickets and assignments.'
                    : 'Enter your work email address to receive a secure sign-in code.'}
                </p>
              </div>

              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '28px', alignItems: 'center' }}>
                <Input
                  label="Work Email"
                  placeholder="yourname@vdartinc.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail size={18} />}
                  type="email"
                  autoComplete="email"
                  required
                />
                <Button
                  type="submit"
                  isLoading={loading}
                  style={{ width: '100%', height: '56px', fontSize: '1.05rem', fontWeight: 800, borderRadius: '12px' }}
                  rightIcon={<ArrowRight size={20} />}
                >
                  Send Sign-in Code
                </Button>

                <p
  style={{
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '0.9rem',
    color: '#6B7280'
  }}
>
  New Employee?{" "}
  <span
    onClick={() => navigate('/register')}
    style={{
      color: '#1F4E79',
      fontWeight: '700',
      cursor: 'pointer'
    }}
  >
    Register Now
  </span>
</p>
              </form>
            </motion.div>
          )}

          {/* Step 1 — Mobile */}
          {step === 'email' && useMobile && (
            <motion.div
              key="mobile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ width: '100%', maxWidth: '420px' }}
            >
              <div style={{ marginBottom: 'var(--s-8)', textAlign: 'center' }}>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#1a1a1a', letterSpacing: '-0.04em', marginBottom: '12px' }}>
                  Mobile Sign-in
                </h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem', lineHeight: 1.5 }}>
                  Enter your phone number to receive a sign-in code via SMS.
                </p>
              </div>
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input
                  label="Phone Number"
                  placeholder="+1 (555) 000-0000"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  type="tel"
                  autoComplete="tel"
                  required
                />
                <Button type="submit" isLoading={loading} style={{ width: '100%', height: '52px' }}>
                  Send OTP Code
                </Button>
              </form>
            </motion.div>
          )}

          {/* Step 2 — OTP Verify */}
          {step === 'otp' && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              style={{ width: '100%', maxWidth: '420px' }}
            >
              <div style={{ marginBottom: 'var(--s-8)', textAlign: 'center' }}>
                <div style={{
                  width: '64px', height: '64px', background: '#EFF6FF', borderRadius: '18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #DBEAFE', margin: '0 auto 28px',
                }}>
                  <ShieldCheck size={32} color="#1F4E79" />
                </div>
                <h2 style={{ fontSize: '2.25rem', fontWeight: 900, marginBottom: '10px', color: '#1a1a1a', letterSpacing: '-0.02em' }}>
                  Verify Identity
                </h2>
                <p style={{ color: 'var(--text-dim)', lineHeight: 1.6, fontSize: '1.05rem' }}>
                  We've sent a 6-digit security code to
                  <div style={{ color: '#1F4E79', fontWeight: 700, marginTop: '4px' }}>
                    {useMobile ? mobile : email}
                  </div>
                </p>
              </div>

              {/* Dev autofill banner — only visible when server returns devOtp */}
              {devOtp && (
                <div style={{
                  background: '#FEF9C3', border: '1px dashed #EAB308',
                  borderRadius: '10px', padding: '8px 14px', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: '0.8rem', fontWeight: 700,
                }}>
                  <span style={{ color: '#854D0E' }}>🛠 Dev OTP: <span style={{ letterSpacing: '3px', fontFamily: 'monospace', fontSize: '1rem' }}>{devOtp}</span></span>
                  <button
                    onClick={() => { setDevOtp(null); setOtp(['','','','','','']); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#854D0E', fontSize: '0.75rem', fontWeight: 800 }}
                  >✕ clear</button>
                </div>
              )}

              {/* ✅ Self-contained OtpInput — paste + mobile SMS autofill, no auto-submit */}
              <div style={{ marginBottom: '28px' }}>
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  disabled={loading || isExpired}
                />
              </div>

              {/* Verify button — sole submission trigger */}
              <Button
                onClick={handleVerifyOtp}
                isLoading={loading}
                disabled={otp.join('').length !== 6 || isExpired || loading}
                style={{ width: '100%', height: '48px', marginBottom: '20px' }}
                rightIcon={<ArrowRight size={18} />}
              >
                {isExpired ? 'Code Expired' : 'Verify & Sign In'}
              </Button>

              {/* Bottom row — back + resend */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <button
                  onClick={() => { setStep('email'); setOtp(['', '', '', '', '', '']); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  ← {useMobile ? 'Change number' : 'Change email'}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <button
                    onClick={handleResend}
                    disabled={resending || cooldown > 0 || isLocked}
                    style={{
                      background: 'none', border: 'none',
                      color: (resending || cooldown > 0 || isLocked) ? 'var(--text-dim)' : 'var(--primary)',
                      fontWeight: 700,
                      cursor: (resending || cooldown > 0 || isLocked) ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <RefreshCw size={14} className={resending ? 'animate-spin' : ''} />
                    {resending
                      ? 'Sending...'
                      : isLocked
                      ? 'Resend Locked'
                      : cooldown > 0
                      ? `Resend in ${cooldown}s`
                      : 'Resend code'}
                  </button>
                  {isLocked && (
                    <span style={{ fontSize: '10px', color: '#EF4444' }}>Max attempts reached</span>
                  )}
                </div>
              </div>

              {/* Expiry timer */}
              <p style={{
                fontSize: '0.8rem',
                color: isExpired ? '#EF4444' : 'var(--text-dim)',
                marginTop: '20px',
                textAlign: 'center',
                fontWeight: isExpired ? 700 : 400,
              }}>
                {isExpired
                  ? 'The code has expired. Please resend.'
                  : `Code expires in ${formatted}`}
              </p>
            </motion.div>
          )}




        {/* {isAckModalOpen && (
          <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '28px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, marginBottom: '6px' }}>Acknowledge ticket</h2>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem', marginBottom: '18px' }}>
                Optionally send a message to the employee letting them know you've picked this up.
              </p>
              <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Message <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <textarea
                className="input"
                style={{ height: '100px', padding: '12px', borderRadius: '12px', marginBottom: '24px' }}
                placeholder="e.g. Hi, I've received your request and will look into it shortly..."
                value={ackMessage}
                onChange={e => setAckMessage(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button variant="ghost" fullWidth onClick={() => { setIsAckModalOpen(false); setAckMessage(''); }}>Cancel</Button>
                <Button fullWidth onClick={handleAcknowledge} leftIcon={<BadgeCheck size={15} />}>
                  {ackMessage.trim() ? 'Acknowledge & send' : 'Acknowledge'}
                </Button>
              </div>
            </motion.div>
          </div>
        )} */}










        </AnimatePresence>
      </div>
    </div>
  );
}