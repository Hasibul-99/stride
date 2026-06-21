import { formatMinutes, type ProjectColor } from '@teamboard/shared';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { Avatar } from '@/components/ui/Avatar';
import { TimerButton } from '@/features/time/TimerButton';
import { cn } from '@/lib/utils';
import type { ProjectMember, Task, TaskStatus } from './api';

interface Props {
  task: Task;
  status?: TaskStatus;
  assignee?: ProjectMember;
  projectColor: ProjectColor;
  onClick?: () => void;
}

export function TaskCard({ task, status, assignee, projectColor, onClick }: Props) {
  const completed = !!task.completedAt;

  return (
    <div
      className={cn(
        'group relative flex w-full flex-col gap-2 rounded-card border border-border bg-surface p-2.5 pl-3 text-left shadow-sm transition hover:border-border-strong hover:shadow-md',
        completed && 'bg-surface-2',
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-card"
        style={{ background: COLOR_HEX[projectColor] }}
      />
      {/* Stretched button: opens the task; its ::after covers the whole card. */}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'line-clamp-2 text-left text-[13px] leading-snug outline-none after:absolute after:inset-0 after:content-[""]',
          completed && 'text-muted line-through',
        )}
      >
        {task.title}
      </button>
      <div className="relative z-10 flex items-center gap-2">
        {completed ? (
          <span className="text-success" title="Completed" aria-label="Completed">
            ✓
          </span>
        ) : (
          status && (
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: COLOR_HEX[status.color] }}
              title={status.name}
            />
          )
        )}
        {task.timeEstimateMinutes ? (
          <span className="rounded bg-background px-1.5 py-0.5 text-[11px] text-muted">
            {formatMinutes(task.timeEstimateMinutes)}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-1.5">
          {!completed && <TimerButton taskId={task.id} />}
          {assignee && <Avatar name={assignee.user.name} avatarUrl={assignee.user.avatarUrl} />}
        </div>
      </div>
    </div>
  );
}
