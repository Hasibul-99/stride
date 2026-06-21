import { useMemo, useState } from 'react';
import { type ProjectColor } from '@teamboard/shared';
import {
  useBulkPositions,
  useCreateTask,
  useProjectMembers,
  useStatuses,
  useTasks,
  type Task,
} from '@/features/tasks/api';
import { TaskCard } from '@/features/tasks/TaskCard';
import { TaskDrawer } from '@/features/tasks/TaskDrawer';
import { SortableBoard, type BoardContainer } from '@/features/board/SortableBoard';
import { calendarMovePayload, WAITING } from './drop';
import { Avatar } from '@/components/ui/Avatar';
import { useEvents, type CalEvent } from '@/features/events/api';
import { EventModal } from '@/features/events/EventModal';
import { EventDrawer } from '@/features/events/EventDrawer';
import { WorkloadFooter } from './WorkloadFooter';
import { format } from 'date-fns';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { buildWeek, rangeOf, shiftWeeks, weekStart } from './week';
import { cn } from '@/lib/utils';

export function CalendarView({ projectId, projectColor }: { projectId: string; projectColor: ProjectColor }) {
  const { data: tasks } = useTasks(projectId);
  const { data: statuses } = useStatuses(projectId);
  const { data: members } = useProjectMembers(projectId);
  const bulk = useBulkPositions(projectId);

  const [ref, setRef] = useState(() => weekStart(new Date()));
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [openEvent, setOpenEvent] = useState<CalEvent | null>(null);
  const [eventModalDate, setEventModalDate] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCompleted, setShowCompleted] = useState(true);

  const week = useMemo(() => buildWeek(ref), [ref]);
  const { from, to } = rangeOf(week);
  const { data: events } = useEvents(`${from}T00:00:00.000Z`, `${to}T23:59:59.000Z`, projectId);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalEvent[]> = {};
    for (const e of events ?? []) {
      const iso = e.startAt.slice(0, 10);
      (map[iso] ??= []).push(e);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.startAt.localeCompare(b.startAt));
    return map;
  }, [events]);

  const filtered = useMemo(() => {
    return (tasks ?? []).filter((t) => {
      if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
      if (statusFilter && t.statusId !== statusFilter) return false;
      if (!showCompleted && t.completedAt) return false;
      return true;
    });
  }, [tasks, assigneeFilter, statusFilter, showCompleted]);

  const itemsByContainer = useMemo(() => {
    const map: Record<string, Task[]> = { [WAITING]: [] };
    for (const d of week) map[d.iso] = [];
    for (const t of filtered) {
      const key = t.scheduledDate && map[t.scheduledDate] ? t.scheduledDate : t.scheduledDate ? null : WAITING;
      if (key === null) continue; // scheduled outside current week
      map[key].push(t);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.position - b.position);
    return map;
  }, [filtered, week]);

  function onDrop(taskId: string, toContainer: string, toIndex: number) {
    const task = tasks?.find((t) => t.id === taskId);
    if (!task) return;
    const dest = (itemsByContainer[toContainer] ?? []).filter((t) => t.id !== taskId);
    const payload = calendarMovePayload(task, dest.map((t) => t.position), toContainer, toIndex);
    if (payload) bulk.mutate(payload);
  }

  const statusById = useMemo(
    () => new Map((statuses ?? []).map((s) => [s.id, s])),
    [statuses],
  );

  const dayContainers: BoardContainer[] = week.map((d) => {
    const dayTasks = itemsByContainer[d.iso] ?? [];
    const dayEvents = eventsByDay[d.iso] ?? [];
    return {
      id: d.iso,
      className: 'flex w-[260px] shrink-0 flex-col rounded-card border border-border bg-surface',
      header: (
        <div>
          <div
            className={cn(
              'flex items-center justify-between border-b border-border px-3 py-2',
              d.isToday && 'bg-primary/5',
            )}
          >
            <span className="text-sm font-medium">
              {d.label} <span className="text-muted">{d.dayNum}</span>
            </span>
            <WorkloadFooter tasks={dayTasks} events={dayEvents} />
          </div>
          {dayEvents.length > 0 && (
            <div className="space-y-1 px-2 pt-2">
              {dayEvents.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setOpenEvent(e)}
                  className="block w-full rounded px-1.5 py-1 text-left text-[11px] leading-tight"
                  style={{ background: `${COLOR_HEX[e.color]}22`, color: COLOR_HEX[e.color] }}
                >
                  <span className="tabular-nums">{format(new Date(e.startAt), 'HH:mm')}</span>{' '}
                  {e.title}
                  {e.recurrenceId ? ' 🔁' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      ),
      footer: <QuickAdd projectId={projectId} scheduledDate={d.iso} />,
    };
  });

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        title={`${week[0].label} ${week[0].dayNum} – ${week[6].label} ${week[6].dayNum}`}
        members={members}
        statuses={statuses}
        assigneeFilter={assigneeFilter}
        statusFilter={statusFilter}
        showCompleted={showCompleted}
        onAssignee={setAssigneeFilter}
        onStatus={setStatusFilter}
        onToggleCompleted={() => setShowCompleted((v) => !v)}
        onPrev={() => setRef((r) => shiftWeeks(r, -1))}
        onNext={() => setRef((r) => shiftWeeks(r, 1))}
        onToday={() => setRef(weekStart(new Date()))}
        onNewEvent={() => setEventModalDate(week[0].iso)}
      />

      <div className="flex flex-1 gap-3 overflow-hidden">
        <SortableBoard
          className="flex flex-1 gap-3 overflow-x-auto pb-2"
          containers={dayContainers}
          itemsByContainer={itemsByContainer}
          onDrop={onDrop}
          renderItem={(t) => (
            <TaskCard
              task={t}
              status={statusById.get(t.statusId)}
              assignee={members?.find((m) => m.user.id === t.assigneeId)}
              projectColor={projectColor}
              onClick={() => setOpenTask(t)}
            />
          )}
        />

        <SortableBoard
          className="flex w-[280px] shrink-0 flex-col"
          containers={[
            {
              id: WAITING,
              className: 'flex flex-1 flex-col rounded-card border border-border bg-background/60',
              header: (
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-sm font-medium">Waiting list</span>
                  <span className="text-xs text-muted">{itemsByContainer[WAITING]?.length ?? 0}</span>
                </div>
              ),
              footer: <QuickAdd projectId={projectId} scheduledDate={null} />,
            },
          ]}
          itemsByContainer={itemsByContainer}
          onDrop={onDrop}
          renderItem={(t) => (
            <TaskCard
              task={t}
              status={statusById.get(t.statusId)}
              assignee={members?.find((m) => m.user.id === t.assigneeId)}
              projectColor={projectColor}
              onClick={() => setOpenTask(t)}
            />
          )}
        />
      </div>

      {openTask && (
        <TaskDrawer
          projectId={projectId}
          task={tasks?.find((t) => t.id === openTask.id) ?? openTask}
          onClose={() => setOpenTask(null)}
        />
      )}
      {openEvent && (
        <EventDrawer
          event={events?.find((e) => e.id === openEvent.id) ?? openEvent}
          onClose={() => setOpenEvent(null)}
        />
      )}
      {eventModalDate && (
        <EventModal
          projectId={projectId}
          defaultDate={eventModalDate}
          onClose={() => setEventModalDate(null)}
        />
      )}
    </div>
  );
}

function QuickAdd({ projectId, scheduledDate }: { projectId: string; scheduledDate: string | null }) {
  const create = useCreateTask(projectId);
  const [title, setTitle] = useState('');
  return (
    <div className="p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter' && title.trim()) {
            await create.mutateAsync({ title: title.trim(), scheduledDate });
            setTitle('');
          }
        }}
        placeholder="+ Add task"
        className="w-full rounded-control border border-transparent bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted hover:border-border focus:border-primary focus:bg-surface"
      />
    </div>
  );
}

interface ToolbarProps {
  title: string;
  members?: { user: { id: string; name: string; avatarUrl: string | null } }[];
  statuses?: { id: string; name: string }[];
  assigneeFilter: string;
  statusFilter: string;
  showCompleted: boolean;
  onAssignee: (v: string) => void;
  onStatus: (v: string) => void;
  onToggleCompleted: () => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onNewEvent: () => void;
}

function Toolbar(p: ToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <button onClick={p.onPrev} className="rounded-control border border-border px-2 py-1 text-sm">
          ‹
        </button>
        <button onClick={p.onToday} className="rounded-control border border-border px-3 py-1 text-sm">
          Today
        </button>
        <button onClick={p.onNext} className="rounded-control border border-border px-2 py-1 text-sm">
          ›
        </button>
      </div>
      <span className="text-sm font-medium">{p.title}</span>
      <button
        onClick={p.onNewEvent}
        className="rounded-control border border-border px-3 py-1 text-sm"
      >
        + Event
      </button>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex -space-x-1">
          {p.members?.slice(0, 6).map((m) => (
            <button
              key={m.user.id}
              aria-label={`Filter by ${m.user.name}`}
              aria-pressed={p.assigneeFilter === m.user.id}
              onClick={() => p.onAssignee(p.assigneeFilter === m.user.id ? '' : m.user.id)}
              className={cn(
                'rounded-full',
                p.assigneeFilter === m.user.id && 'ring-2 ring-primary',
              )}
            >
              <Avatar name={m.user.name} avatarUrl={m.user.avatarUrl} />
            </button>
          ))}
        </div>
        <select
          value={p.statusFilter}
          onChange={(e) => p.onStatus(e.target.value)}
          className="rounded-control border border-border bg-surface px-2 py-1 text-sm"
        >
          <option value="">All statuses</option>
          {p.statuses?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm text-muted">
          <input type="checkbox" checked={p.showCompleted} onChange={p.onToggleCompleted} />
          Completed
        </label>
      </div>
    </div>
  );
}
