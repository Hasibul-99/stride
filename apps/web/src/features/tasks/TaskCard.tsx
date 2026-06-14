import { formatMinutes, type ProjectColor } from '@teamboard/shared';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { Avatar } from '@/components/ui/Avatar';
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
    <button
      onClick={onClick}
      className={cn(
        'group relative flex w-full flex-col gap-2 rounded-card border border-border bg-surface p-2.5 pl-3 text-left transition hover:border-foreground/30',
        completed && 'opacity-60',
      )}
    >
      <span
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-card"
        style={{ background: COLOR_HEX[projectColor] }}
      />
      <span
        className={cn('line-clamp-2 text-[13px] leading-snug', completed && 'line-through')}
      >
        {task.title}
      </span>
      <div className="flex items-center gap-2">
        {status && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: COLOR_HEX[status.color] }}
            title={status.name}
          />
        )}
        {task.timeEstimateMinutes ? (
          <span className="rounded bg-background px-1.5 py-0.5 text-[11px] text-muted">
            {formatMinutes(task.timeEstimateMinutes)}
          </span>
        ) : null}
        <span className="ml-auto">
          {assignee && <Avatar name={assignee.user.name} avatarUrl={assignee.user.avatarUrl} />}
        </span>
      </div>
    </button>
  );
}
