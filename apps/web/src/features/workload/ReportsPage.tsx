import { useState } from 'react';
import { format } from 'date-fns';
import { useWorkspaceStore } from '@/store/workspace.store';
import { formatElapsed } from '@/features/time/api';
import { useAuthStore } from '@/store/auth.store';
import { useTimeReport } from './api';

export function ReportsPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;
  const token = useAuthStore((s) => s.accessToken);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data } = useTimeReport(workspaceId, { from: from || undefined, to: to || undefined });

  async function downloadCsv() {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await fetch(`/api/workspaces/${workspaceId}/time-report.csv?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'time-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <header className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Time reports</h1>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-control border border-border bg-surface px-2 py-1" />
          <span className="text-muted">→</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-control border border-border bg-surface px-2 py-1" />
          <button onClick={downloadCsv} className="rounded-control bg-primary px-3 py-1 font-medium text-primary-foreground">
            Export CSV
          </button>
        </div>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Summary title="By user" rows={data?.byUser ?? []} />
        <Summary title="By project" rows={data?.byProject ?? []} />
      </div>

      <div className="rounded-card border border-border">
        <div className="border-b border-border px-3 py-2 text-sm font-medium">
          Total: {formatElapsed(data?.totalSeconds ?? 0)}
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-muted">
            <tr className="border-b border-border">
              <th className="px-3 py-1.5">User</th>
              <th className="px-3 py-1.5">Project</th>
              <th className="px-3 py-1.5">Task</th>
              <th className="px-3 py-1.5">Started</th>
              <th className="px-3 py-1.5">Duration</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((e) => (
              <tr key={e.id} className="border-b border-border">
                <td className="px-3 py-1.5">{e.user.name}</td>
                <td className="px-3 py-1.5">{e.task.project.name}</td>
                <td className="px-3 py-1.5">{e.task.title}</td>
                <td className="px-3 py-1.5 text-muted">{format(new Date(e.startedAt), 'd MMM HH:mm')}</td>
                <td className="px-3 py-1.5">{formatElapsed(e.durationSeconds ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Summary({ title, rows }: { title: string; rows: { label: string; seconds: number }[] }) {
  return (
    <div className="rounded-card border border-border p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      {rows.length === 0 && <p className="text-sm text-muted">No data.</p>}
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between py-0.5 text-sm">
          <span>{r.label}</span>
          <span className="text-muted">{formatElapsed(r.seconds)}</span>
        </div>
      ))}
    </div>
  );
}
