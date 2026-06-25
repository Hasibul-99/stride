import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForgotPassword } from './api';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const forgot = useForgotPassword();
  const [email, setEmail] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // The API never reveals whether the email exists — always proceed to reset.
    try {
      await forgot.mutateAsync({ email });
    } catch {
      // ignore — still proceed (no enumeration)
    }
    navigate('/auth/reset', { state: { email } });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-modal border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Reset your password</h1>
        <p className="mb-6 text-muted">Enter your email and we'll send you a reset code.</p>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={forgot.isPending}
            className="w-full rounded-control bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {forgot.isPending ? 'Sending…' : 'Send reset code'}
          </button>
        </form>
        <p className="mt-6 text-center text-muted">
          <Link to="/auth/signin" className="text-primary underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
