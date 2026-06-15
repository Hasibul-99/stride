import { useMemo, useState } from 'react';
import { formatMinutes } from '@teamboard/shared';
import { useWorkspaceStore } from '@/store/workspace.store';
import { Avatar } from '@/components/ui/Avatar';
import { buildWeek, rangeOf, shiftWeeks, weekStart } from '@/features/calendar/week';
import { useWorkload, useSetCapacity, type WorkloadCell } from './api';
import { cn } from '@/lib/utils';

export function WorkloadPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;
  const [ref, setRef] = useState(() => weekStart(new Date()));
  const week = useMemo(() => buildWeek(ref), [ref]);
  const { from, to } = rangeOf(week);
  const { data } = useWorkload(workspaceId, from, to);
  const setCapacity = useSetCapacity(workspaceId);

  return (
    <div className="flex h-full flex-col">
      <header className="mb-3 flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Workload</h1>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setRef((r) => shiftWeeks(r, -1))} className="rounded-control border border-border px-2 py-1 text-sm">‹</button>
          <button onClick={() => setRef(weekStart(new Date()))} className="rounded-control border border-border px-3 py-1 text-sm">This week</button>
          <button onClick={() => setRef((r) => shiftWeeks(r, 1))} className="rounded-control border border-border px-2 py-1 text-sm">›</button>
        </div>
      </header>

      <div className="flex-1 overflow-auto rounded-card border border-border">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: '200px repeat(7, 1fr) 90px' }}>
          <Cellhead>Member</Cellhead>
          {week.map((d) => (
            <Cellhead key={d.iso} today={d.isToday}>
              {d.label} {d.dayNum}
            </Cellhead>
          ))}
          <Cellhead>Week</Cellhead>

          {data?.members.map((m) => {
            const row = data.cells[m.userId] ?? {};
            const weekMin = week.reduce((s, d) => s + cellMinutes(row[d.iso]), 0);
            return (
              <div key={m.userId} className="contents">
                <div className="flex items-center gap-2 border-b border-r border-border bg-surface px-3 py-2">
                  <Avatar name={m.name} avatarUrl={m.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{m.name}</div>
                    <input
                      type="number"
                      defaultValue={m.capacityMinutes / 60}
                      onBlur={(e) => {
                        const h = Number(e.target.value);
                        if (h >= 0) setCapacity.mutate({ userId: m.userId, dailyMinutes: Math.round(h * 60) });
                      }}
                      className="w-16 rounded border border-border bg-surface px-1 text-xs text-muted"
                      title="Daily capacity (hours)"
                    />
                  </div>
                </div>
                {week.map((d) => {
                  const mins = cellMinutes(row[d.iso]);
                  const tint =
                    mins > m.capacityMinutes * 1.25
                      ? 'bg-red-500/10'
                      : mins > m.capacityMinutes
                        ? 'bg-amber-500/10'
                        : '';
                  return (
                    <div key={d.iso} className={cn('border-b border-r border-border px-2 py-2 text-sm', tint)}>
                      {mins > 0 ? formatMinutes(mins) : <span className="text-muted">—</span>}
                      {row[d.iso]?.unestimatedCount ? (
                        <div className="text-[10px] text-muted">+{row[d.iso].unestimatedCount} no est</div>
                      ) : null}
                    </div>
                  );
                })}
                <div className="border-b border-border px-2 py-2 text-sm font-medium">{formatMinutes(weekMin)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function cellMinutes(c?: WorkloadCell): number {
  return c ? c.taskMinutes + c.eventMinutes : 0;
}

function Cellhead({ children, today }: { children: React.ReactNode; today?: boolean }) {
  return (
    <div className={cn('border-b border-r border-border bg-surface px-3 py-2 text-sm font-medium', today && 'bg-primary/5')}>
      {children}
    </div>
  );
}
