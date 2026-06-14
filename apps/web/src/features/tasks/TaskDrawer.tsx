import { useEffect, useState } from 'react';
import { formatMinutes, parseDurationToMinutes } from '@teamboard/shared';
import { COLOR_HEX } from '@/features/workspaces/colors';
import {
  useDeleteTask,
  useProjectMembers,
  useStatuses,
  useUpdateTask,
  type Task,
} from './api';

interface Props {
  projectId: string;
  task: Task;
  onClose: () => void;
}

export function TaskDrawer({ projectId, task, onClose }: Props) {
  const { data: statuses } = useStatuses(projectId);
  const { data: members } = useProjectMembers(projectId);
  const update = useUpdateTask(projectId);
  const del = useDeleteTask(projectId);

  const [title, setTitle] = useState(task.title);
  const [estimate, setEstimate] = useState(formatMinutes(task.timeEstimateMinutes));

  useEffect(() => {
    setTitle(task.title);
    setEstimate(formatMinutes(task.timeEstimateMinutes));
  }, [task]);

  function saveTitle() {
    if (title.trim() && title !== task.title) {
      update.mutate({ id: task.id, title: title.trim() });
    }
  }

  function saveEstimate() {
    const minutes = estimate.trim() ? parseDurationToMinutes(estimate) : null;
    update.mutate({ id: task.id, timeEstimateMinutes: minutes });
  }

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <aside
        className="absolute right-0 top-0 flex h-full w-[420px] flex-col gap-5 overflow-y-auto border-l border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-muted hover:text-foreground">
            ← Close
          </button>
          <button
            onClick={async () => {
              await del.mutateAsync(task.id);
              onClose();
            }}
            className="text-sm text-red-600"
          >
            Delete
          </button>
        </div>

        <textarea
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          rows={2}
          className="resize-none rounded-control border border-border bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-primary"
        />

        <Field label="Status">
          <select
            value={task.statusId}
            onChange={(e) => update.mutate({ id: task.id, statusId: e.target.value })}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          >
            {statuses?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.isCompleted ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Assignee">
          <select
            value={task.assigneeId ?? ''}
            onChange={(e) =>
              update.mutate({ id: task.id, assigneeId: e.target.value || null })
            }
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          >
            <option value="">Unassigned</option>
            {members?.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Date">
          <div className="flex gap-2">
            <input
              type="date"
              value={task.scheduledDate ?? ''}
              onChange={(e) =>
                update.mutate({ id: task.id, scheduledDate: e.target.value || null })
              }
              className="flex-1 rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
            />
            {task.scheduledDate && (
              <button
                onClick={() => update.mutate({ id: task.id, scheduledDate: null })}
                className="rounded-control border border-border px-2 text-xs text-muted"
              >
                Waiting list
              </button>
            )}
          </div>
        </Field>

        <Field label="Time estimate">
          <input
            value={estimate}
            onChange={(e) => setEstimate(e.target.value)}
            onBlur={saveEstimate}
            placeholder="e.g. 1h 30m"
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
        </Field>

        {task.completedAt && (
          <div
            className="rounded-control px-3 py-2 text-sm"
            style={{ background: `${COLOR_HEX.green}22`, color: COLOR_HEX.green }}
          >
            Completed {new Date(task.completedAt).toLocaleDateString()}
          </div>
        )}
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
      {children}
    </div>
  );
}
