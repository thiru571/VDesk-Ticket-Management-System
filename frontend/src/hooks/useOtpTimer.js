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
  maxResends = 3
} = {}) {
  const [timeLeft, setTimeLeft]         = useState(expirySeconds);
  const [cooldown, setCooldown]         = useState(0);      // resend button cooldown
  const [resendCount, setResendCount]   = useState(0);
  const [isExpired, setIsExpired]       = useState(false);
  const [isLocked, setIsLocked]         = useState(false);  // resend locked after maxResends

  const expiryTimer  = useRef(null);
  const cooldownTimer = useRef(null);

  // ── Countdown (OTP expiry) ───────────────────────────────────────────────
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

  // ── Resend cooldown ──────────────────────────────────────────────────────
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

  // Called when user clicks Resend
  const onResend = useCallback(() => {
    if (cooldown > 0 || isLocked) return false;

    const next = resendCount + 1;
    setResendCount(next);
    if (next >= maxResends) setIsLocked(true);

    startExpiry();
    startCooldown();
    return true; // caller should make the API call
  }, [cooldown, isLocked, resendCount, maxResends, startExpiry, startCooldown]);

  // Start timers on mount
  useEffect(() => {
    startExpiry();
    startCooldown();
    return () => {
      clearInterval(expiryTimer.current);
      clearInterval(cooldownTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Formatted MM:SS string
  const formatted = `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}`;

  return {
    timeLeft,
    formatted,      // e.g. "04:59"
    isExpired,
    cooldown,       // seconds remaining on resend cooldown
    resendCount,
    isLocked,       // true when resend attempts exhausted
    onResend,       // call this; returns true if resend allowed
    canResend: cooldown === 0 && !isLocked && !isExpired === false, // convenience
  };
}
