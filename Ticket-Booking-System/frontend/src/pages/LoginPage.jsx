import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button, Input } from '../ui';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import OtpInput from '../components/OtpInput';
import { useOtpTimer } from '../hooks/useOtpTimer';
import Logo from '../assets/logo.svg';

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

  // ── OTP timer hook ──────────────────────────────────────────────────────────
  const { formatted, isExpired, cooldown, onResend, isLocked } = useOtpTimer({
    expirySeconds: 300,
    resendCooldown: 30,
    maxResends: 3,
  });

  // ── Step 1 — Send OTP ───────────────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e?.preventDefault();
    if (!email.trim()) return toast.error('Please enter your work email');

    const allowedDomains = ['@vdartinc.com', '@ndartinc.com'];
    const isValid = allowedDomains.some((d) => email.toLowerCase().endsWith(d));
    if (!isValid) {
      return toast.error('Please use a valid company email (@vdartinc.com or @ndartinc.com).');
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { email });
      toast.success(res.data.message || 'Code sent! Check your email inbox.');
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
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
    try {
      const res = await api.post('/auth/send-otp', { email });
      toast.success(res.data.message || 'New code sent!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  // ── OTP input handlers (NO auto-verify — button only) ───────────────────────
  const inputRefs = useRef([]);

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    // Move focus forward — do NOT auto-submit
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      // Focus last box so user sees it filled — do NOT auto-submit
      inputRefs.current[5]?.focus();
    }
  };

  // ── Step 2 — Verify OTP (button-click only) ─────────────────────────────────
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) return toast.error('Please enter the full 6-digit code');
    if (loading) return; // prevent duplicate calls

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-otp', { email, otp: otpCode });
      loginWithToken(res.data.token, res.data.user);
      toast.success(`Welcome back, ${res.data.user.name || 'there'}!`);
      const role = res.data.user.role;
      navigate(['admin', 'support_agent'].includes(role) ? '/dashboard' : '/tickets');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
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
              { label: 'Staff', mobile: false, disabled: true },
              { label: 'Mobile Access', mobile: true, disabled: false },
            ].map(({ label, mobile, disabled }) => {
              const active = !disabled && (mobile ? useMobile : (!useMobile && step === 'email' && label === 'Employee'));
              return (
                <button
                  key={label}
                  onClick={disabled ? undefined : () => { setUseMobile(mobile); setStep('email'); }}
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
                <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#1a1a1a', letterSpacing: '-0.04em', marginBottom: '12px' }}>
                  Welcome back
                </h2>
                <p style={{ color: 'var(--text-dim)', fontSize: '1.1rem', lineHeight: 1.5 }}>
                  Enter your work email address to receive a secure sign-in code.
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
              <h2 style={{ fontSize: '1.875rem', fontWeight: 800, marginBottom: '20px' }}>
                Mobile Sign-in
              </h2>
              <form onSubmit={handleSendOtp} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input
                  label="Phone Number"
                  placeholder="+1 (555) 000-0000"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  style={{ height: '52px', fontSize: '16px' }}
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
                  <div style={{ color: '#1F4E79', fontWeight: 700, marginTop: '4px' }}>{email}</div>
                </p>
              </div>

              {/* OTP boxes — no onComplete to avoid auto-submit */}
              <div style={{ marginBottom: '28px' }}>
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  disabled={loading || isExpired}
                  inputRefs={inputRefs}
                  onKeyDown={handleOtpKeyDown}
                  onPaste={handleOtpPaste}
                  onCellChange={handleOtpChange}
                  // ✅ onComplete intentionally omitted — button-only verify
                />
              </div>

              {/* Verify button — single trigger point */}
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
                  ← Change email
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

        </AnimatePresence>
      </div>
    </div>
  );
}