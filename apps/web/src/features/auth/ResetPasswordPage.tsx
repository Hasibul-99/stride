import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { OTP_LENGTH } from '@teamboard/shared';
import { OtpInput } from '@/components/ui/OtpInput';
import { toast } from '@/store/toast.store';
import { useForgotPassword, useResetPassword } from './api';
import { useResendCountdown } from './useResendCountdown';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as { email?: string };
  const email = state.email ?? new URLSearchParams(location.search).get('email') ?? '';

  const reset = useResetPassword();
  const resend = useForgotPassword();
  const countdown = useResendCountdown();

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!email) navigate('/auth/forgot', { replace: true });
  }, [email, navigate]);

  const canSubmit = code.length === OTP_LENGTH && password.length >= 8 && password === confirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      if (password !== confirm) setError('Passwords do not match');
      return;
    }
    setError(null);
    try {
      await reset.mutateAsync({ email, code, password, passwordConfirmation: confirm });
      toast('Password updated — please sign in', 'success');
      navigate('/auth/signin');
    } catch (err) {
      const msg =
        isAxiosError(err) && typeof err.response?.data?.message === 'string'
          ? err.response.data.message
          : 'Invalid or expired code';
      setError(msg);
      setCode('');
      setResetKey((k) => k + 1);
    }
  }

  function onResend() {
    if (!countdown.canResend) return;
    resend.mutate({ email });
    countdown.restart();
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-modal border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Set a new password</h1>
        <p className="mb-6 text-muted">
          Enter the code sent to <span className="font-medium text-foreground">{email}</span> and choose a
          new password.
        </p>

        <form className="space-y-4" onSubmit={onSubmit}>
          <OtpInput key={resetKey} onChange={setCode} disabled={reset.isPending} invalid={!!error} />

          <input
            type="password"
            required
            minLength={8}
            placeholder="New password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />

          {error && <p className="text-center text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit || reset.isPending}
            className="w-full rounded-control bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {reset.isPending ? 'Updating…' : 'Update password'}
          </button>
        </form>

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
