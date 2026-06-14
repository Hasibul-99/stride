import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/store/auth.store';

type SessionStatus = 'loading' | 'authed' | 'anon';

/**
 * On first mount, restore a session via the httpOnly refresh cookie.
 * Access tokens live in memory only, so a page reload always re-refreshes.
 */
export function useSession(): SessionStatus {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const [status, setStatus] = useState<SessionStatus>(accessToken ? 'authed' : 'loading');

  useEffect(() => {
    if (accessToken) {
      setStatus('authed');
      return;
    }
    let active = true;
    (async () => {
      try {
        const res = await axios.post<{ accessToken: string }>(
          '/api/auth/refresh',
          {},
          { withCredentials: true },
        );
        if (!active) return;
        setAccessToken(res.data.accessToken);
        setStatus('authed');
      } catch {
        if (active) setStatus('anon');
      }
    })();
    return () => {
      active = false;
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}
