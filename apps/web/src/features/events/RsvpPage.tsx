import { useEffect, useState } from 'react';
import axios from 'axios';
import type { RsvpStatus } from '@teamboard/shared';

/** Public landing for invite-email RSVP links: /rsvp?token=&response= */
export function RsvpPage() {
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const [response, setResponse] = useState<RsvpStatus | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const resp = (params.get('response') as RsvpStatus) ?? 'ACCEPTED';
    if (!token) {
      setState('error');
      return;
    }
    axios
      .post('/api/events/rsvp', { token, response: resp })
      .then(() => {
        setResponse(resp);
        setState('done');
      })
      .catch(() => setState('error'));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-modal border border-border bg-surface p-8 text-center shadow-sm">
        {state === 'loading' && <p className="text-muted">Recording your response…</p>}
        {state === 'done' && (
          <p>
            You responded <strong>{response?.toLowerCase()}</strong>. Thanks!
          </p>
        )}
        {state === 'error' && <p className="text-red-600">This invite link is invalid or expired.</p>}
      </div>
    </div>
  );
}
