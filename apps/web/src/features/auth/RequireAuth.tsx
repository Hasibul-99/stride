import { Navigate } from 'react-router-dom';
import { useSession } from './useSession';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>
    );
  }
  if (status === 'anon') {
    return <Navigate to="/auth/signin" replace />;
  }
  return <>{children}</>;
}
