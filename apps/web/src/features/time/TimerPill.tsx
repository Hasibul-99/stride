import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatElapsed, useRunningTimer, useStopTimer } from './api';

/** Global header pill showing the running timer; click to jump, stop from anywhere. */
export function TimerPill() {
  const { data: running } = useRunningTimer();
  const stop = useStopTimer();
  const navigate = useNavigate();
  const [, tick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  if (!running) return null;

  const elapsed = Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000);

  // Reconciliation prompt for a timer that's been running absurdly long (>12h).
  if (elapsed > 12 * 3600) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-warning/40 bg-warning-tint px-3 py-1 text-sm text-warning">
        Timer running 12h+ on “{running.task.title}” —
        <button onClick={() => stop.mutate(running.task.id)} className="font-medium underline">
          stop &amp; keep
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm">
      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
      <button
        onClick={() => navigate(`/app/projects/${running.task.projectId}`)}
        className="max-w-[180px] truncate"
        title={running.task.title}
      >
        {running.task.title}
      </button>
      <span className="font-mono tabular-nums text-muted">{formatElapsed(elapsed)}</span>
      <button
        onClick={() => stop.mutate(running.task.id)}
        className="rounded bg-background px-1.5 py-0.5 text-xs"
      >
        Stop
      </button>
    </div>
  );
}
