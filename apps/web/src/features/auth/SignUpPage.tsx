import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useSignup } from './api';

export function SignUpPage() {
  const navigate = useNavigate();
  const signup = useSignup();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signup.mutateAsync({ name, email, password });
      navigate('/auth/verify', { state: { email } });
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 409) {
        setError('That email is already registered.');
      } else if (isAxiosError(err) && err.response?.status === 400) {
        setError('Password must be at least 8 characters.');
      } else {
        setError('Something went wrong. Try again.');
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-modal border border-border bg-surface p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Create your account</h1>
        <p className="mb-6 text-muted">Start managing work with your team.</p>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            type="text"
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
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
            minLength={8}
            placeholder="Password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={signup.isPending}
            className="w-full rounded-control bg-primary px-3 py-2 font-medium text-primary-foreground disabled:opacity-60"
          >
            {signup.isPending ? 'Creating…' : 'Sign up'}
          </button>
        </form>
        <p className="mt-6 text-center text-muted">
          Already have an account?{' '}
          <Link to="/auth/signin" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
