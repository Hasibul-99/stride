import { MouseEvent } from 'react';
import { useRunningTimer, useStartTimer, useStopTimer } from './api';
import { cn } from '@/lib/utils';

/** Play/stop toggle for a task. Stops event propagation so it works on cards. */
export function TimerButton({ taskId, className }: { taskId: string; className?: string }) {
  const { data: running } = useRunningTimer();
  const start = useStartTimer();
  const stop = useStopTimer();
  const isRunning = running?.task.id === taskId;

  function onClick(e: MouseEvent) {
    e.stopPropagation();
    if (isRunning) stop.mutate(taskId);
    else start.mutate(taskId);
  }

  return (
    <button
      onClick={onClick}
      title={isRunning ? 'Stop timer' : 'Start timer'}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full text-[10px]',
        isRunning ? 'bg-red-500 text-white' : 'bg-background text-muted hover:text-foreground',
        className,
      )}
    >
      {isRunning ? '■' : '▶'}
    </button>
  );
}
