import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { formatMinutes } from '@teamboard/shared';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { TimerButton } from '@/features/time/TimerButton';
import { formatElapsed, useDeleteTimeEntry, useTaskTime } from '@/features/time/api';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { FilesSection } from '@/features/files/FilesSection';
import { StatusSelect } from './StatusSelect';
import { TimeEstimateInput } from './TimeEstimateInput';
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

  useEffect(() => {
    setTitle(task.title);
  }, [task]);

  function saveTitle() {
    if (title.trim() && title !== task.title) {
      update.mutate({ id: task.id, title: title.trim() });
    }
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
              if (task.recurrenceId) {
                const all = window.confirm(
                  'Recurring task. OK = delete ALL occurrences, Cancel = just this one.',
                );
                await del.mutateAsync({ id: task.id, scope: all ? 'ALL' : 'THIS' });
              } else {
                await del.mutateAsync(task.id);
              }
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
          <StatusSelect
            statuses={statuses ?? []}
            value={task.statusId}
            onChange={(statusId) => update.mutate({ id: task.id, statusId })}
          />
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
          <TimeEstimateInput
            minutes={task.timeEstimateMinutes}
            onCommit={(minutes) => update.mutate({ id: task.id, timeEstimateMinutes: minutes })}
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

        <TimeSection task={task} />
        <FilesSection taskId={task.id} />
        <ChatPanel taskId={task.id} />
      </aside>
    </div>
  );
}

function TimeSection({ task }: { task: Task }) {
  const { data } = useTaskTime(task.id);
  const del = useDeleteTimeEntry(task.id);
  const total = data?.totalSeconds ?? 0;
  const estimateSec = (task.timeEstimateMinutes ?? 0) * 60;
  const pct = estimateSec > 0 ? Math.min(100, Math.round((total / estimateSec) * 100)) : 0;

  return (
    <div className="border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Time</span>
        <TimerButton taskId={task.id} />
      </div>

      <div className="mb-2 text-sm">
        Tracked <strong>{formatElapsed(total)}</strong>
        {estimateSec > 0 && <span className="text-muted"> / {formatMinutes(task.timeEstimateMinutes)} est</span>}
      </div>
      {estimateSec > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-background">
          <div
            className="h-full"
            style={{ width: `${pct}%`, background: pct > 100 ? COLOR_HEX.red : COLOR_HEX.blue }}
          />
        </div>
      )}

      <div className="space-y-1">
        {data?.entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-xs text-muted">
            <span className="flex-1 truncate">
              {e.user?.name} · {format(new Date(e.startedAt), 'd MMM HH:mm')}
            </span>
            <span>{e.durationSeconds ? formatElapsed(e.durationSeconds) : 'running'}</span>
            <button onClick={() => del.mutate(e.id)} className="text-red-600">×</button>
          </div>
        ))}
        {data && data.entries.length === 0 && <p className="text-xs text-muted">No time logged.</p>}
      </div>
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
