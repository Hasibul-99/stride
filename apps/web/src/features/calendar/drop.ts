import type { BulkPositionsInput } from '@teamboard/shared';
import { positionForIndex } from '@/features/tasks/positions';

export const WAITING = 'waiting';

interface MovableTask {
  id: string;
  scheduledDate: string | null;
  position: number;
}

/**
 * Compute the bulk-positions update for a calendar drag: drop `task` into
 * `toContainer` (a 'YYYY-MM-DD' day id, or WAITING) at `toIndex`.
 * `destPositions` are positions of tasks already in the target day/list.
 * Moving to/from the waiting list toggles scheduledDate null↔date.
 * Returns null when nothing changed.
 */
export function calendarMovePayload(
  task: MovableTask,
  destPositions: number[],
  toContainer: string,
  toIndex: number,
): BulkPositionsInput | null {
  const scheduledDate = toContainer === WAITING ? null : toContainer;
  const position = positionForIndex(destPositions, toIndex);
  const changedDate = (task.scheduledDate ?? null) !== scheduledDate;
  if (!changedDate && task.position === position) return null;
  return { updates: [{ id: task.id, scheduledDate, position }] };
}
