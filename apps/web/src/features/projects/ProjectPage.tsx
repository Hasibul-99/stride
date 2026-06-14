import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { formatMinutes } from '@teamboard/shared';
import { useProject } from '@/features/workspaces/api';
import { COLOR_HEX } from '@/features/workspaces/colors';
import {
  useCreateTask,
  useProjectMembers,
  useStatuses,
  useTasks,
  type Task,
} from '@/features/tasks/api';
import { TaskCard } from '@/features/tasks/TaskCard';
import { TaskDrawer } from '@/features/tasks/TaskDrawer';
import { StatusManager } from '@/features/tasks/StatusManager';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError } = useProject(id);
  const { data: statuses } = useStatuses(id);
  const { data: tasks } = useTasks(id);
  const { data: members } = useProjectMembers(id);

  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [showStatuses, setShowStatuses] = useState(false);

  const byStatus = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks ?? []) {
      const arr = map.get(t.statusId) ?? [];
      arr.push(t);
      map.set(t.statusId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [tasks]);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (isError || !project) return <p className="text-muted">Project not found or no access.</p>;

  // Keep a synced view of the open task from the latest list.
  const current = openTask ? (tasks?.find((t) => t.id === openTask.id) ?? openTask) : null;

  return (
    <div className="flex h-full flex-col">
      <header className="mb-4 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[project.color] }} />
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <button
          onClick={() => setShowStatuses(true)}
          className="ml-auto rounded-control border border-border px-3 py-1.5 text-sm"
        >
          Manage statuses
        </button>
      </header>

      <div className="flex flex-1 gap-4 overflow-x-auto pb-2">
        {statuses?.map((s) => {
          const colTasks = byStatus.get(s.id) ?? [];
          const totalMin = colTasks.reduce((sum, t) => sum + (t.timeEstimateMinutes ?? 0), 0);
          return (
            <div key={s.id} className="flex w-72 shrink-0 flex-col rounded-card bg-background/60">
              <div className="flex items-center gap-2 px-2 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[s.color] }} />
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted">{colTasks.length}</span>
                {totalMin > 0 && (
                  <span className="ml-auto text-xs text-muted">{formatMinutes(totalMin)}</span>
                )}
              </div>
              <div className="flex flex-col gap-2 px-2 pb-2">
                {colTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    status={s}
                    assignee={members?.find((m) => m.user.id === t.assigneeId)}
                    projectColor={project.color}
                    onClick={() => setOpenTask(t)}
                  />
                ))}
                <QuickAdd projectId={project.id} statusId={s.id} />
              </div>
            </div>
          );
        })}
      </div>

      {current && id && (
        <TaskDrawer projectId={id} task={current} onClose={() => setOpenTask(null)} />
      )}
      {showStatuses && id && (
        <StatusManager projectId={id} onClose={() => setShowStatuses(false)} />
      )}
    </div>
  );
}

function QuickAdd({ projectId, statusId }: { projectId: string; statusId: string }) {
  const create = useCreateTask(projectId);
  const [title, setTitle] = useState('');

  async function submit() {
    if (!title.trim()) return;
    await create.mutateAsync({ title: title.trim(), statusId });
    setTitle('');
  }

  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') submit();
      }}
      placeholder="+ Add task"
      className="rounded-control border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted hover:border-border focus:border-primary focus:bg-surface"
    />
  );
}
