import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
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

type ColKey = 'title' | 'status' | 'assignee' | 'date' | 'estimate';
type GroupBy = 'none' | 'status' | 'assignee' | 'date';

const ALL_COLS: { key: ColKey; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'assignee', label: 'Assignee' },
  { key: 'date', label: 'Date' },
  { key: 'estimate', label: 'Estimate' },
];

const COLS_LS_KEY = 'tb-table-cols';

function loadHidden(): Set<ColKey> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLS_LS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function TableView({ projectId }: { projectId: string }) {
  const { data: tasks } = useTasks(projectId);
  const { data: statuses } = useStatuses(projectId);
  const { data: members } = useProjectMembers(projectId);
  const update = useUpdateTask(projectId);
  const del = useDeleteTask(projectId);

  const [sortKey, setSortKey] = useState<ColKey>('date');
  const [sortAsc, setSortAsc] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [hidden, setHidden] = useState<Set<ColKey>>(loadHidden);
  const [colsOpen, setColsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const statusById = useMemo(() => new Map((statuses ?? []).map((s) => [s.id, s])), [statuses]);
  const memberById = useMemo(() => new Map((members ?? []).map((m) => [m.user.id, m.user])), [members]);
  const cols = ALL_COLS.filter((c) => !hidden.has(c.key));

  const rows = useMemo(() => {
    const list = (tasks ?? []).filter((t) => showCompleted || !t.completedAt);
    const dir = sortAsc ? 1 : -1;
    return [...list].sort((a, b) => dir * compare(a, b, sortKey, statusById, memberById));
  }, [tasks, showCompleted, sortKey, sortAsc, statusById, memberById]);

  const groups = useMemo(() => {
    if (groupBy === 'none') return null;
    const map = new Map<string, Task[]>();
    for (const t of rows) {
      const key = groupLabel(t, groupBy, statusById, memberById);
      (map.get(key) ?? map.set(key, []).get(key)!).push(t);
    }
    return [...map.entries()];
  }, [rows, groupBy, statusById, memberById]);

  function toggleCol(key: ColKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(COLS_LS_KEY, JSON.stringify([...next]));
      return next;
    });
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

  const renderRow = (t: Task) => (
    <Row
      key={t.id}
      task={t}
      cols={cols}
      statuses={statuses ?? []}
      members={members ?? []}
      status={statusById.get(t.statusId)}
      selected={selected.has(t.id)}
      onSelect={() => toggleSelect(t.id)}
      onUpdate={(patch) => update.mutate({ id: t.id, ...patch })}
    />
  );

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-sm text-muted">
          <input type="checkbox" checked={showCompleted} onChange={() => setShowCompleted((v) => !v)} />
          Completed
        </label>
        <select
          aria-label="Group by"
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value as GroupBy)}
          className="rounded-control border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="none">No grouping</option>
          <option value="status">Group by status</option>
          <option value="assignee">Group by assignee</option>
          <option value="date">Group by date</option>
        </select>
        <div className="relative">
          <button onClick={() => setColsOpen((o) => !o)} className="rounded-control border border-border px-2 py-1 text-sm">
            Columns
          </button>
          {colsOpen && (
            <div className="absolute z-10 mt-1 w-40 rounded-control border border-border bg-surface p-2 shadow-md">
              {ALL_COLS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                  <input type="checkbox" checked={!hidden.has(c.key)} onChange={() => toggleCol(c.key)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted">{selected.size} selected</span>
            <select
              aria-label="Bulk set status"
              defaultValue=""
              onChange={(e) => e.target.value && bulkStatus(e.target.value)}
              className="rounded-control border border-border bg-surface px-2 py-1"
            >
              <option value="">Set status…</option>
              {statuses?.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <button onClick={bulkDelete} className="rounded-control border border-border px-2 py-1 text-danger">
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto rounded-card border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-left text-muted">
              <th className="w-8 px-2 py-2"></th>
              {cols.map((c) => (
                <Th key={c.key} label={c.label} onClick={() => (sortKey === c.key ? setSortAsc((v) => !v) : (setSortKey(c.key), setSortAsc(true)))} active={sortKey === c.key} asc={sortAsc} />
              ))}
            </tr>
          </thead>
          {groups ? (
            <tbody>
              {groups.map(([label, items]) => (
                <GroupBlock key={label} label={label} count={items.length} colSpan={cols.length + 1}>
                  {items.map(renderRow)}
                </GroupBlock>
              ))}
            </tbody>
          ) : rows.length > VIRTUALIZE_THRESHOLD ? (
            <VirtualBody rows={rows} renderRow={renderRow} colSpan={cols.length + 1} />
          ) : (
            <tbody>{rows.map(renderRow)}</tbody>
          )}
        </table>
      </div>
    </div>
  );
}

// Below this row count, plain rendering is cheaper than virtualization.
const VIRTUALIZE_THRESHOLD = 50;

/** Virtualized tbody for large ungrouped lists. */
function VirtualBody({ rows, renderRow, colSpan }: { rows: Task[]; renderRow: (t: Task) => React.ReactNode; colSpan: number }) {
  const parentRef = useRef<HTMLTableSectionElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current?.closest('.overflow-auto') ?? null,
    estimateSize: () => 37,
    overscan: 12,
  });
  const items = v.getVirtualItems();
  const padTop = items[0]?.start ?? 0;
  const padBottom = v.getTotalSize() - (items[items.length - 1]?.end ?? 0);
  return (
    <tbody ref={parentRef}>
      {padTop > 0 && <tr style={{ height: padTop }}><td colSpan={colSpan} /></tr>}
      {items.map((vi) => renderRow(rows[vi.index]))}
      {padBottom > 0 && <tr style={{ height: padBottom }}><td colSpan={colSpan} /></tr>}
    </tbody>
  );
}

function GroupBlock({ label, count, colSpan, children }: { label: string; count: number; colSpan: number; children: React.ReactNode }) {
  return (
    <tbody>
      <tr className="bg-surface-2">
        <td colSpan={colSpan} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {label} · {count}
        </td>
      </tr>
      {children}
    </tbody>
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
  cols: { key: ColKey; label: string }[];
  statuses: { id: string; name: string }[];
  members: { user: { id: string; name: string } }[];
  status?: { color: import('@teamboard/shared').ProjectColor; name: string };
  selected: boolean;
  onSelect: () => void;
  onUpdate: (patch: Partial<{ title: string; statusId: string; assigneeId: string | null; scheduledDate: string | null }>) => void;
}

function Row({ task, cols, statuses, members, status, selected, onSelect, onUpdate }: RowProps) {
  const [title, setTitle] = useState(task.title);
  const visible = new Set(cols.map((c) => c.key));
  return (
    <tr className={cn('border-b border-border hover:bg-background/50', task.completedAt && 'opacity-60')}>
      <td className="px-2 py-1.5"><input type="checkbox" checked={selected} onChange={onSelect} /></td>
      {visible.has('title') && (
        <td className="px-2 py-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && onUpdate({ title: title.trim() })}
            className={cn('w-full bg-transparent outline-none', task.completedAt && 'line-through')}
          />
        </td>
      )}
      {visible.has('status') && (
        <td className="px-2 py-1.5">
          <span className="inline-flex items-center gap-1.5">
            {status && <span className="h-2 w-2 rounded-full" style={{ background: COLOR_HEX[status.color] }} />}
            <select value={task.statusId} onChange={(e) => onUpdate({ statusId: e.target.value })} className="bg-transparent outline-none">
              {statuses.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </span>
        </td>
      )}
      {visible.has('assignee') && (
        <td className="px-2 py-1.5">
          <select value={task.assigneeId ?? ''} onChange={(e) => onUpdate({ assigneeId: e.target.value || null })} className="bg-transparent outline-none">
            <option value="">—</option>
            {members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}
          </select>
        </td>
      )}
      {visible.has('date') && (
        <td className="px-2 py-1.5">
          <input type="date" value={task.scheduledDate ?? ''} onChange={(e) => onUpdate({ scheduledDate: e.target.value || null })} className="bg-transparent outline-none" />
        </td>
      )}
      {visible.has('estimate') && (
        <td className="px-2 py-1.5 text-muted">{formatMinutes(task.timeEstimateMinutes) || '—'}</td>
      )}
    </tr>
  );
}

function compare(
  a: Task,
  b: Task,
  key: ColKey,
  statusById: Map<string, { position: number }>,
  memberById: Map<string, { name: string }>,
): number {
  switch (key) {
    case 'title':
      return a.title.localeCompare(b.title);
    case 'status':
      return (statusById.get(a.statusId)?.position ?? 0) - (statusById.get(b.statusId)?.position ?? 0);
    case 'assignee':
      return (memberById.get(a.assigneeId ?? '')?.name ?? '').localeCompare(memberById.get(b.assigneeId ?? '')?.name ?? '');
    case 'date':
      return (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '');
    case 'estimate':
      return (a.timeEstimateMinutes ?? 0) - (b.timeEstimateMinutes ?? 0);
  }
}

function groupLabel(
  t: Task,
  by: GroupBy,
  statusById: Map<string, { name: string }>,
  memberById: Map<string, { name: string }>,
): string {
  if (by === 'status') return statusById.get(t.statusId)?.name ?? 'No status';
  if (by === 'assignee') return memberById.get(t.assigneeId ?? '')?.name ?? 'Unassigned';
  if (by === 'date') return t.scheduledDate ?? 'Waiting list';
  return '';
}
