import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { OTP_LENGTH } from '@teamboard/shared';
import { OtpInput } from '@/components/ui/OtpInput';
import { useResendOtp, useVerifyEmail } from './api';
import { useResendCountdown } from './useResendCountdown';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as { email?: string; autoResend?: boolean };
  const email = state.email ?? new URLSearchParams(location.search).get('email') ?? '';

  const verify = useVerifyEmail();
  const resend = useResendOtp();
  const countdown = useResendCountdown();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const didAutoResend = useRef(false);

  // Arriving from a "not verified yet" sign-in → push a fresh code automatically.
  useEffect(() => {
    if (state.autoResend && email && !didAutoResend.current) {
      didAutoResend.current = true;
      resend.mutate({ email, purpose: 'registration' });
    }
  }, [state.autoResend, email, resend]);

  useEffect(() => {
    if (!email) navigate('/auth/signup', { replace: true });
  }, [email, navigate]);

  async function submit(value: string) {
    setError(null);
    try {
      await verify.mutateAsync({ email, code: value });
      navigate('/app');
    } catch (err) {
      const msg =
        isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Invalid or expired code';
      setError(msg);
      setCode('');
      setResetKey((k) => k + 1); // clears the boxes + refocuses the first
    }
  }

  function onResend() {
    if (!countdown.canResend) return;
    resend.mutate({ email, purpose: 'registration' });
    countdown.restart();
    setError(null);
    setCode('');
    setResetKey((k) => k + 1);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-modal border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Verify your email</h1>
        <p className="mb-6 text-muted">
          We sent a confirmation code to <span className="font-medium text-foreground">{email}</span>
        </p>

        <OtpInput
          key={resetKey}
          onChange={setCode}
          onComplete={submit}
          disabled={verify.isPending}
          invalid={!!error}
        />

        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}

        <button
          type="button"
          onClick={() => submit(code)}
          disabled={code.length < OTP_LENGTH || verify.isPending}
          className="mt-6 w-full rounded-control bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-60"
        >
          {verify.isPending ? 'Verifying…' : 'Verify'}
        </button>

        <p className="mt-6 text-center text-muted">
          {countdown.canResend ? (
            <button type="button" onClick={onResend} className="text-primary underline">
              Send it again
            </button>
          ) : (
            <span>Resend in {countdown.label}</span>
          )}
        </p>
      </div>
    </div>
  );
}
