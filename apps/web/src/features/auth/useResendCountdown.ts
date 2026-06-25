import { useCallback, useEffect, useState } from 'react';
import { OTP_RESEND_COOLDOWN_SECONDS } from '@teamboard/shared';

/** Live resend cooldown timer. Starts counting immediately (a code was just sent). */
export function useResendCountdown(seconds: number = OTP_RESEND_COOLDOWN_SECONDS) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  const restart = useCallback(() => setRemaining(seconds), [seconds]);
  const label = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;

  return { remaining, canResend: remaining <= 0, restart, label };
}
