import { useRef, useEffect } from 'react';

/**
 * OtpInput — Enterprise OTP Component
 *
 * Features:
 * ✅ Auto focus
 * ✅ Auto next input
 * ✅ Backspace navigation
 * ✅ Arrow navigation
 * ✅ Paste full OTP
 * ✅ Mobile OTP autofill support
 * ✅ Clipboard OTP detection
 * ✅ Auto submit on complete
 */

export default function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true
}) {

  const refs = useRef([]);

  // Auto-focus first input
  useEffect(() => {
    if (autoFocus) {
      refs.current[0]?.focus();
    }
  }, [autoFocus]);

  // Auto-read OTP from clipboard (modern UX)
  useEffect(() => {

    const readClipboardOtp = async () => {
      try {

        const text = await navigator.clipboard.readText();

        const match = text.match(/\b\d{6}\b/);

        if (match) {

          const code = match[0];

          const next = code.split('');

          onChange(next);

          onComplete?.(code);
        }

      } catch (err) {
        // Ignore clipboard permission errors
      }
    };

    readClipboardOtp();

  }, [onChange, onComplete]);

  // Handle typing
  const handleChange = (index, raw) => {

    const digit = raw.replace(/\D/g, '').slice(-1);

    const next = [...value];

    next[index] = digit;

    onChange(next);

    // Move to next box
    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }

    // Auto submit
    const full = next.join('');

    if (full.length === 6 && !full.includes('')) {
      onComplete?.(full);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (index, e) => {

    // Backspace previous
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }

    // Arrow left
    if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    }

    // Arrow right
    if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  // Handle full OTP paste
  const handlePaste = (e) => {

    e.preventDefault();

    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, 6);

    if (!pasted.length) return;

    const next = [...value];

    pasted.split('').forEach((d, i) => {
      if (i < 6) next[i] = d;
    });

    onChange(next);

    // Focus next empty box
    const focusIdx = Math.min(pasted.length, 5);

    refs.current[focusIdx]?.focus();

    // Auto verify
    if (pasted.length === 6) {
      onComplete?.(pasted);
    }
  };

  return (

    <div
      style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'center'
      }}
      onPaste={handlePaste}
    >

      {value.map((digit, i) => {

        const filled = digit !== '';

        return (

          <input
            key={i}

            ref={el => refs.current[i] = el}

            type="text"

            inputMode="numeric"

            autoComplete={i === 0 ? 'one-time-code' : 'off'}

            pattern="[0-9]*"

            enterKeyHint="done"

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

              border: `2.5px solid ${
                filled ? '#1E40AF' : 'var(--border)'
              }`,

              borderRadius: '12px',

              background: filled
                ? '#EFF6FF'
                : 'var(--bg)',

              color: 'var(--text-main)',

              outline: 'none',

              transition:
                'border-color 0.15s, background 0.15s, transform 0.1s',

              cursor: disabled
                ? 'not-allowed'
                : 'text',

              opacity: disabled ? 0.5 : 1,

              transform: filled
                ? 'scale(1.04)'
                : 'scale(1)',

              boxShadow: filled
                ? '0 0 0 3px rgba(30,64,175,0.12)'
                : 'none'
            }}

            onFocus={e => {

              e.target.style.borderColor = '#1E40AF';

              e.target.style.boxShadow =
                '0 0 0 3px rgba(30,64,175,0.15)';
            }}

            onBlur={e => {

              e.target.style.borderColor =
                digit ? '#1E40AF' : 'var(--border)';

              e.target.style.boxShadow =
                digit
                  ? '0 0 0 3px rgba(30,64,175,0.12)'
                  : 'none';
            }}
          />
        );
      })}
    </div>
  );
}
