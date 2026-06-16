import { useMemo, useState } from 'react';
import { formatMinutes } from '@teamboard/shared';
import {
  useDeleteTask,
  useProjectMembers,
  useStatuses,
  useTasks,
  useUpdateTask,
  type Task,
} from '@/features/tasks/api';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { cn } from '@/lib/utils';

type SortKey = 'title' | 'status' | 'assignee' | 'date' | 'estimate';

export function TableView({ projectId }: { projectId: string }) {
  const { data: tasks } = useTasks(projectId);
  const { data: statuses } = useStatuses(projectId);
  const { data: members } = useProjectMembers(projectId);
  const update = useUpdateTask(projectId);
  const del = useDeleteTask(projectId);

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortAsc, setSortAsc] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const statusById = useMemo(() => new Map((statuses ?? []).map((s) => [s.id, s])), [statuses]);
  const memberById = useMemo(
    () => new Map((members ?? []).map((m) => [m.user.id, m.user])),
    [members],
  );

  const rows = useMemo(() => {
    const list = (tasks ?? []).filter((t) => showCompleted || !t.completedAt);
    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => {
      const cmp = (() => {
        switch (sortKey) {
          case 'title':
            return a.title.localeCompare(b.title);
          case 'status':
            return (statusById.get(a.statusId)?.position ?? 0) - (statusById.get(b.statusId)?.position ?? 0);
          case 'assignee':
            return (memberById.get(a.assigneeId ?? '')?.name ?? '').localeCompare(
              memberById.get(b.assigneeId ?? '')?.name ?? '',
            );
          case 'date':
            return (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '');
          case 'estimate':
            return (a.timeEstimateMinutes ?? 0) - (b.timeEstimateMinutes ?? 0);
        }
      })();
      return cmp * dir;
    });
  }, [tasks, showCompleted, sortKey, sortAsc, statusById, memberById]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    for (const id of selected) await del.mutateAsync(id);
    setSelected(new Set());
  }

  async function bulkStatus(statusId: string) {
    for (const id of selected) await update.mutateAsync({ id, statusId });
    setSelected(new Set());
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <label className="flex items-center gap-1 text-sm text-muted">
          <input type="checkbox" checked={showCompleted} onChange={() => setShowCompleted((v) => !v)} />
          Completed
        </label>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted">{selected.size} selected</span>
            <select
              defaultValue=""
              onChange={(e) => e.target.value && bulkStatus(e.target.value)}
              className="rounded-control border border-border bg-surface px-2 py-1"
            >
              <option value="">Set status…</option>
              {statuses?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button onClick={bulkDelete} className="rounded-control border border-border px-2 py-1 text-red-600">
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded-card border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-border text-left text-muted">
              <th className="w-8 px-2 py-2"></th>
              <Th label="Title" onClick={() => toggleSort('title')} active={sortKey === 'title'} asc={sortAsc} />
              <Th label="Status" onClick={() => toggleSort('status')} active={sortKey === 'status'} asc={sortAsc} />
              <Th label="Assignee" onClick={() => toggleSort('assignee')} active={sortKey === 'assignee'} asc={sortAsc} />
              <Th label="Date" onClick={() => toggleSort('date')} active={sortKey === 'date'} asc={sortAsc} />
              <Th label="Estimate" onClick={() => toggleSort('estimate')} active={sortKey === 'estimate'} asc={sortAsc} />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <Row
                key={t.id}
                task={t}
                statuses={statuses ?? []}
                members={members ?? []}
                status={statusById.get(t.statusId)}
                selected={selected.has(t.id)}
                onSelect={() => toggleSelect(t.id)}
                onUpdate={(patch) => update.mutate({ id: t.id, ...patch })}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ label, onClick, active, asc }: { label: string; onClick: () => void; active: boolean; asc: boolean }) {
  return (
    <th className="cursor-pointer px-2 py-2 font-medium hover:text-foreground" onClick={onClick}>
      {label}
      {active && <span className="ml-1">{asc ? '↑' : '↓'}</span>}
    </th>
  );
}

interface RowProps {
  task: Task;
  statuses: { id: string; name: string }[];
  members: { user: { id: string; name: string } }[];
  status?: { color: import('@teamboard/shared').ProjectColor; name: string };
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<{ title: string; statusId: string; assigneeId: string | null; scheduledDate: string | null }>) => void;
}

function Row({ task, statuses, members, status, selected, onSelect, onUpdate }: RowProps) {
  const [title, setTitle] = useState(task.title);
  return (
    <tr className={cn('border-b border-border hover:bg-background/50', task.completedAt && 'opacity-60')}>
      <td className="px-2 py-1.5">
        <input type="checkbox" checked={selected} onChange={onSelect} />
      </td>
      <td className="px-2 py-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && onUpdate({ title: title.trim() })}
          className={cn('w-full bg-transparent outline-none', task.completedAt && 'line-through')}
        />
      </td>
      <td className="px-2 py-1.5">
        <span className="inline-flex items-center gap-1.5">
          {status && <span className="h-2 w-2 rounded-full" style={{ background: COLOR_HEX[status.color] }} />}
          <select
            value={task.statusId}
            onChange={(e) => onUpdate({ statusId: e.target.value })}
            className="bg-transparent outline-none"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </span>
      </td>
      <td className="px-2 py-1.5">
        <select
          value={task.assigneeId ?? ''}
          onChange={(e) => onUpdate({ assigneeId: e.target.value || null })}
          className="bg-transparent outline-none"
        >
          <option value="">—</option>
          {members.map((m) => (
            <option key={m.user.id} value={m.user.id}>
              {m.user.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input
          type="date"
          value={task.scheduledDate ?? ''}
          onChange={(e) => onUpdate({ scheduledDate: e.target.value || null })}
          className="bg-transparent outline-none"
        />
      </td>
      <td className="px-2 py-1.5 text-muted">{formatMinutes(task.timeEstimateMinutes) || '—'}</td>
    </tr>
  );
}
