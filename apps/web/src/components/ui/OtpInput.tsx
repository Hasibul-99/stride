import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { OTP_LENGTH } from '@teamboard/shared';
import { cn } from '@/lib/utils';

interface Props {
  /** Called with the assembled code on every change (length 0…length). */
  onChange: (code: string) => void;
  /** Called once all boxes are filled. */
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}

/**
 * Accessible N-box OTP entry: numeric-only, auto-advance, backspace-to-previous,
 * and full-code paste spread across boxes. Self-contained — the parent receives
 * the assembled code via onChange/onComplete. To clear + refocus (e.g. on error),
 * remount it by changing its React `key`.
 */
export function OtpInput({
  onChange,
  onComplete,
  length = OTP_LENGTH,
  disabled = false,
  invalid = false,
  autoFocus = true,
}: Props) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function emit(next: string[]) {
    setDigits(next);
    const code = next.join('');
    onChange(code);
    if (code.length === length && next.every((d) => d !== '')) onComplete?.(code);
  }

  function handleChange(i: number) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const digit = e.target.value.replace(/\D/g, '').slice(-1);
      if (!digit) return;
      const next = [...digits];
      next[i] = digit;
      emit(next);
      if (i < length - 1) refs.current[i + 1]?.focus();
    };
  }

  function handleKeyDown(i: number) {
    return (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        e.preventDefault();
        const next = [...digits];
        if (next[i]) {
          next[i] = '';
          emit(next);
        } else if (i > 0) {
          next[i - 1] = '';
          emit(next);
          refs.current[i - 1]?.focus();
        }
      } else if (e.key === 'ArrowLeft' && i > 0) {
        refs.current[i - 1]?.focus();
      } else if (e.key === 'ArrowRight' && i < length - 1) {
        refs.current[i + 1]?.focus();
      }
    };
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    const next = Array(length).fill('');
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    emit(next);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="Verification code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          value={d}
          disabled={disabled}
          onChange={handleChange(i)}
          onKeyDown={handleKeyDown(i)}
          onPaste={handlePaste}
          className={cn(
            'h-12 w-12 rounded-control border bg-surface text-center text-xl font-semibold outline-none focus:border-primary',
            invalid ? 'border-red-500' : 'border-border',
            disabled && 'opacity-60',
          )}
        />
      ))}
    </div>
  );
}
