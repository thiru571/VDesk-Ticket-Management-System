import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useOtpTimer — manages OTP countdown, resend cooldown and attempt limiting.
 * @param {number} expirySeconds   - OTP validity window (default 300 = 5 min)
 * @param {number} resendCooldown  - seconds to wait before next resend (default 30)
 * @param {number} maxResends      - max resend attempts before permanent lock (default 3)
 */
export function useOtpTimer({
  expirySeconds = 300,
  resendCooldown = 30,
  maxResends = 3,
} = {}) {
  const [timeLeft, setTimeLeft]       = useState(expirySeconds);
  const [cooldown, setCooldown]       = useState(0);   // ✅ 0 on mount — no initial cooldown
  const [resendCount, setResendCount] = useState(0);
  const [isExpired, setIsExpired]     = useState(false);
  const [isLocked, setIsLocked]       = useState(false);

  const expiryTimer   = useRef(null);
  const cooldownTimer = useRef(null);

  // ── OTP expiry countdown ─────────────────────────────────────────────────
  const startExpiry = useCallback(() => {
    clearInterval(expiryTimer.current);
    setTimeLeft(expirySeconds);
    setIsExpired(false);

    expiryTimer.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(expiryTimer.current);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [expirySeconds]);

  // ── Resend button cooldown ───────────────────────────────────────────────
  const startCooldown = useCallback(() => {
    clearInterval(cooldownTimer.current);
    setCooldown(resendCooldown);

    cooldownTimer.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) {
          clearInterval(cooldownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [resendCooldown]);

  // ── Called when user clicks Resend ───────────────────────────────────────
  // Returns true if resend is allowed (caller makes the API call),
  // false if blocked by cooldown or lock.
  const onResend = useCallback(() => {
    if (cooldown > 0 || isLocked) return false;

    const next = resendCount + 1;
    setResendCount(next);
    if (next >= maxResends) setIsLocked(true);

    startExpiry();
    startCooldown();
    return true;
  }, [cooldown, isLocked, resendCount, maxResends, startExpiry, startCooldown]);

  // ── Start only the expiry timer on mount (no initial resend cooldown) ────
  useEffect(() => {
    startExpiry();
    return () => {
      clearInterval(expiryTimer.current);
      clearInterval(cooldownTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // MM:SS display string
  const formatted = [
    String(Math.floor(timeLeft / 60)).padStart(2, '0'),
    String(timeLeft % 60).padStart(2, '0'),
  ].join(':');

  return {
    timeLeft,
    formatted,    // e.g. "04:59"
    isExpired,
    cooldown,     // seconds left on resend cooldown (0 = ready)
    resendCount,
    isLocked,     // true when all resend attempts exhausted
    onResend,     // call this on resend click; returns true if allowed
    // ✅ Fixed: resend is allowed when no cooldown, not locked
    // (expired OTP is intentionally resendable — that's the recovery path)
    canResend: cooldown === 0 && !isLocked,
  };
}