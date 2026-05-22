import { useRef, useEffect } from 'react';

/**
 * OtpInput — a 6-box OTP entry component.
 *
 * Props:
 *   value        string[]   - array of 6 digit strings (controlled)
 *   onChange     (newArr) => void
 *   onComplete   (sixDigitString) => void  - called when 6th digit is filled
 *   disabled     bool
 *   autoFocus    bool
 */
export default function OtpInput({ value, onChange, onComplete, disabled = false, autoFocus = true }) {
  const refs = useRef([]);

  // Auto-focus first box on mount
  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const handleChange = (index, raw) => {
    // Allow only single digit
    const digit = raw.replace(/\D/g, '').slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);

    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
    if (digit && index === 5) {
      const full = next.join('');
      if (full.length === 6) onComplete?.(full);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
    // Arrow navigation
    if (e.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    const next = [...value];
    pasted.split('').forEach((d, i) => { if (i < 6) next[i] = d; });
    onChange(next);
    // Focus last filled or next empty
    const focusIdx = Math.min(pasted.length, 5);
    refs.current[focusIdx]?.focus();
    if (pasted.length === 6) onComplete?.(pasted);
  };

  return (
    <div style={{ display: 'flex', gap: '10px' }} onPaste={handlePaste}>
      {value.map((digit, i) => {
        const filled = digit !== '';
        return (
          <input
            key={i}
            ref={el => refs.current[i] = el}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            disabled={disabled}
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            style={{
              width: '52px',
              height: '62px',
              textAlign: 'center',
              fontSize: '1.6rem',
              fontWeight: 800,
              fontFamily: 'monospace',
              border: `2.5px solid ${filled ? '#1E40AF' : 'var(--border)'}`,
              borderRadius: '12px',
              background: filled ? '#EFF6FF' : 'var(--bg)',
              color: 'var(--text-main)',
              outline: 'none',
              transition: 'border-color 0.15s, background 0.15s, transform 0.1s',
              cursor: disabled ? 'not-allowed' : 'text',
              opacity: disabled ? 0.5 : 1,
              transform: filled ? 'scale(1.04)' : 'scale(1)',
              boxShadow: filled ? '0 0 0 3px rgba(30,64,175,0.12)' : 'none'
            }}
            onFocus={e => { e.target.style.borderColor = '#1E40AF'; e.target.style.boxShadow = '0 0 0 3px rgba(30,64,175,0.15)'; }}
            onBlur={e => {
              e.target.style.borderColor = digit ? '#1E40AF' : 'var(--border)';
              e.target.style.boxShadow = digit ? '0 0 0 3px rgba(30,64,175,0.12)' : 'none';
            }}
          />
        );
      })}
    </div>
  );
}
