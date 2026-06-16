import { useGcalConnect, useGcalDisconnect, useGcalStatus, useGcalSync } from './api';

export function SettingsPage() {
  const { data: status } = useGcalStatus();
  const connect = useGcalConnect();
  const disconnect = useGcalDisconnect();
  const sync = useGcalSync();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

      <section className="rounded-card border border-border p-5">
        <h2 className="mb-1 text-lg font-medium">Integrations</h2>
        <p className="mb-4 text-sm text-muted">Connect external services to TeamBoard.</p>

        <div className="flex items-center gap-3 rounded-control border border-border p-3">
          <span className="text-2xl">📅</span>
          <div className="flex-1">
            <div className="font-medium">Google Calendar</div>
            <div className="text-sm text-muted">
              {!status?.configured
                ? 'Not configured on this server.'
                : status.connected
                  ? 'Connected — two-way sync active.'
                  : 'Sync your meetings both ways.'}
            </div>
          </div>

          {status?.configured && status.connected ? (
            <div className="flex gap-2">
              <button
                onClick={() => sync.mutate()}
                className="rounded-control border border-border px-3 py-1.5 text-sm"
              >
                {sync.isPending ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                onClick={() => disconnect.mutate()}
                className="rounded-control border border-border px-3 py-1.5 text-sm text-red-600"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              disabled={!status?.configured || connect.isPending}
              onClick={() => connect.mutate()}
              className="rounded-control bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Connect
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
