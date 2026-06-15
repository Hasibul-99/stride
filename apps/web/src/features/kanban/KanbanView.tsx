import { useMemo, useState } from 'react';
import { formatMinutes, type ProjectColor } from '@teamboard/shared';
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
import { StatusManager } from '@/features/tasks/StatusManager';
import { positionForIndex } from '@/features/tasks/positions';
import { SortableBoard, type BoardContainer } from '@/features/board/SortableBoard';
import { COLOR_HEX } from '@/features/workspaces/colors';

export function KanbanView({ projectId, projectColor }: { projectId: string; projectColor: ProjectColor }) {
  const { data: tasks } = useTasks(projectId);
  const { data: statuses } = useStatuses(projectId);
  const { data: members } = useProjectMembers(projectId);
  const bulk = useBulkPositions(projectId);

  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);
  const [assigneeFilter, setAssigneeFilter] = useState('');

  const ordered = useMemo(
    () => [...(statuses ?? [])].sort((a, b) => a.position - b.position),
    [statuses],
  );

  const itemsByContainer = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const s of ordered) map[s.id] = [];
    for (const t of tasks ?? []) {
      if (!map[t.statusId]) continue;
      if (!showCompleted && t.completedAt) continue;
      if (assigneeFilter && t.assigneeId !== assigneeFilter) continue;
      map[t.statusId].push(t);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.position - b.position);
    return map;
  }, [tasks, ordered, showCompleted, assigneeFilter]);

  function onDrop(taskId: string, toStatusId: string, toIndex: number) {
    const task = tasks?.find((t) => t.id === taskId);
    if (!task) return;
    const dest = (itemsByContainer[toStatusId] ?? []).filter((t) => t.id !== taskId);
    const position = positionForIndex(dest.map((t) => t.position), toIndex);
    if (task.statusId === toStatusId && task.position === position) return;
    bulk.mutate({ updates: [{ id: taskId, statusId: toStatusId, position }] });
  }

  const containers: BoardContainer[] = ordered.map((s) => {
    const colTasks = itemsByContainer[s.id] ?? [];
    const load = colTasks.reduce((sum, t) => sum + (t.timeEstimateMinutes ?? 0), 0);
    return {
      id: s.id,
      className: 'flex w-72 shrink-0 flex-col rounded-card bg-background/60',
      header: (
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[s.color] }} />
          <span className="text-sm font-medium">{s.name}</span>
          <span className="text-xs text-muted">{colTasks.length}</span>
          {load > 0 && <span className="ml-auto text-xs text-muted">{formatMinutes(load)}</span>}
        </div>
      ),
      footer: <QuickAdd projectId={projectId} statusId={s.id} />,
    };
  });

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex -space-x-1">
          {members?.slice(0, 6).map((m) => (
            <button
              key={m.user.id}
              onClick={() => setAssigneeFilter(assigneeFilter === m.user.id ? '' : m.user.id)}
              className={assigneeFilter === m.user.id ? 'rounded-full ring-2 ring-primary' : 'rounded-full'}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[10px] text-muted">
                {m.user.name.slice(0, 2).toUpperCase()}
              </span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-sm text-muted">
          <input type="checkbox" checked={showCompleted} onChange={() => setShowCompleted((v) => !v)} />
          Completed
        </label>
        <button
          onClick={() => setShowStatuses(true)}
          className="ml-auto rounded-control border border-border px-3 py-1.5 text-sm"
        >
          Manage statuses
        </button>
      </div>

      <SortableBoard
        className="flex flex-1 gap-4 overflow-x-auto pb-2"
        containers={containers}
        itemsByContainer={itemsByContainer}
        onDrop={onDrop}
        renderItem={(t) => (
          <TaskCard
            task={t}
            status={ordered.find((s) => s.id === t.statusId)}
            assignee={members?.find((m) => m.user.id === t.assigneeId)}
            projectColor={projectColor}
            onClick={() => setOpenTask(t)}
          />
        )}
      />

      {openTask && (
        <TaskDrawer
          projectId={projectId}
          task={tasks?.find((t) => t.id === openTask.id) ?? openTask}
          onClose={() => setOpenTask(null)}
        />
      )}
      {showStatuses && <StatusManager projectId={projectId} onClose={() => setShowStatuses(false)} />}
    </div>
  );
}

function QuickAdd({ projectId, statusId }: { projectId: string; statusId: string }) {
  const create = useCreateTask(projectId);
  const [title, setTitle] = useState('');
  return (
    <div className="px-2 pb-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={async (e) => {
          if (e.key === 'Enter' && title.trim()) {
            await create.mutateAsync({ title: title.trim(), statusId });
            setTitle('');
          }
        }}
        placeholder="+ Add task"
        className="w-full rounded-control border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted hover:border-border focus:border-primary focus:bg-surface"
      />
    </div>
  );
}
