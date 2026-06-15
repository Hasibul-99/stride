import { useMemo, useState } from 'react';
import { formatMinutes, WORKLOAD_AMBER_MINUTES, WORKLOAD_RED_MINUTES } from '@teamboard/shared';
import { useWorkspaceStore } from '@/store/workspace.store';
import { Avatar } from '@/components/ui/Avatar';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { buildWeek, rangeOf, shiftWeeks, weekStart } from './week';
import { usePlanner, usePlannerMembers, type PlannerTask } from './api';
import { cn } from '@/lib/utils';

const UNASSIGNED = '__unassigned__';

export function TeamPlannerPage() {
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;
  const [ref, setRef] = useState(() => weekStart(new Date()));
  const week = useMemo(() => buildWeek(ref), [ref]);
  const { from, to } = rangeOf(week);

  const { data: members } = usePlannerMembers(workspaceId);
  const { data: tasks } = usePlanner(workspaceId, from, to);

  // tasks[memberId][iso] = PlannerTask[]
  const grid = useMemo(() => {
    const map: Record<string, Record<string, PlannerTask[]>> = {};
    for (const t of tasks ?? []) {
      if (!t.scheduledDate) continue;
      const mid = t.assigneeId ?? UNASSIGNED;
      (map[mid] ??= {});
      (map[mid][t.scheduledDate] ??= []).push(t);
    }
    return map;
  }, [tasks]);

  const rows = useMemo(() => {
    const list = (members ?? []).map((m) => ({ id: m.id, name: m.name, avatarUrl: m.avatarUrl }));
    if (grid[UNASSIGNED]) list.push({ id: UNASSIGNED, name: 'Unassigned', avatarUrl: null });
    return list;
  }, [members, grid]);

  return (
    <div className="flex h-full flex-col">
      <header className="mb-3 flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Team board</h1>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setRef((r) => shiftWeeks(r, -1))} className="rounded-control border border-border px-2 py-1 text-sm">
            ‹
          </button>
          <button onClick={() => setRef(weekStart(new Date()))} className="rounded-control border border-border px-3 py-1 text-sm">
            Today
          </button>
          <button onClick={() => setRef((r) => shiftWeeks(r, 1))} className="rounded-control border border-border px-2 py-1 text-sm">
            ›
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto rounded-card border border-border">
        <div className="grid min-w-[900px]" style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
          {/* Header */}
          <div className="sticky left-0 top-0 z-10 border-b border-r border-border bg-surface px-3 py-2 text-sm font-medium">
            Member
          </div>
          {week.map((d) => (
            <div
              key={d.iso}
              className={cn(
                'border-b border-r border-border px-3 py-2 text-sm font-medium',
                d.isToday && 'bg-primary/5',
              )}
            >
              {d.label} <span className="text-muted">{d.dayNum}</span>
            </div>
          ))}

          {/* Rows */}
          {rows.map((m) => (
            <Row key={m.id} member={m} week={week} grid={grid[m.id] ?? {}} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({
  member,
  week,
  grid,
}: {
  member: { id: string; name: string; avatarUrl: string | null };
  week: ReturnType<typeof buildWeek>;
  grid: Record<string, PlannerTask[]>;
}) {
  const weekLoad = Object.values(grid)
    .flat()
    .reduce((s, t) => s + (t.timeEstimateMinutes ?? 0), 0);

  return (
    <>
      <div className="sticky left-0 z-10 flex items-center gap-2 border-b border-r border-border bg-surface px-3 py-2">
        <Avatar name={member.name} avatarUrl={member.avatarUrl} />
        <div className="min-w-0">
          <div className="truncate text-sm">{member.name}</div>
          {weekLoad > 0 && <div className="text-xs text-muted">{formatMinutes(weekLoad)}/wk</div>}
        </div>
      </div>
      {week.map((d) => {
        const dayTasks = grid[d.iso] ?? [];
        const load = dayTasks.reduce((s, t) => s + (t.timeEstimateMinutes ?? 0), 0);
        const tint =
          load > WORKLOAD_RED_MINUTES
            ? 'bg-red-500/5'
            : load > WORKLOAD_AMBER_MINUTES
              ? 'bg-amber-500/5'
              : '';
        return (
          <div key={d.iso} className={cn('min-h-[64px] space-y-1 border-b border-r border-border p-1.5', tint)}>
            {dayTasks.map((t) => (
              <div
                key={t.id}
                className={cn(
                  'rounded border border-border bg-surface px-1.5 py-1 text-[11px] leading-tight',
                  t.completedAt && 'line-through opacity-60',
                )}
              >
                <span
                  className="mr-1 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: COLOR_HEX[t.project.color] }}
                />
                {t.title}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
