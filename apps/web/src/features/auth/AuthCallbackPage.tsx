import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';

/** Lands here after Google OAuth: token arrives in the URL fragment. */
export function AuthCallbackPage() {
  const navigate = useNavigate();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    if (token) {
      setAccessToken(token);
      navigate('/app', { replace: true });
    } else {
      navigate('/auth/signin', { replace: true });
    }
  }, [navigate, setAccessToken]);

  return <div className="flex min-h-screen items-center justify-center text-muted">Signing in…</div>;
}
