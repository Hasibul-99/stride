import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useSignin } from './api';

export function SignInPage() {
  const navigate = useNavigate();
  const signin = useSignin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signin.mutateAsync({ email, password });
      navigate('/app');
    } catch (err) {
      setError(
        isAxiosError(err) && err.response?.status === 401
          ? 'Invalid email or password'
          : 'Something went wrong. Try again.',
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-modal border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Sign in to TeamBoard</h1>
        <p className="mb-6 text-muted">Plan work. Track progress. Get things done.</p>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={signin.isPending}
            className="w-full rounded-control bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {signin.isPending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <a
          href="/api/auth/google"
          className="mt-3 block w-full rounded-control border border-border px-3 py-2 text-center font-medium"
        >
          Continue with Google
        </a>
        <p className="mt-6 text-center text-muted">
          No account?{' '}
          <Link to="/auth/signup" className="text-primary">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
