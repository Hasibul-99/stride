import type { BulkPositionsInput } from '@teamboard/shared';
import { positionForIndex } from '@/features/tasks/positions';

interface MovableTask {
  id: string;
  statusId: string;
  position: number;
}

/**
 * Compute the bulk-positions update for a Kanban drag: drop `task` into the
 * column `toStatusId` at `toIndex`. `destPositions` are the positions of the
 * tasks already in the target column (excluding the dragged one), in order.
 * Returns null when nothing changed (status + position identical).
 *
 * Dropping into a status with `isCompleted` is what completes the task — the
 * server stamps completedAt on receiving this statusId (see api e2e).
 */
export function kanbanMovePayload(
  task: MovableTask,
  destPositions: number[],
  toStatusId: string,
  toIndex: number,
): BulkPositionsInput | null {
  const position = positionForIndex(destPositions, toIndex);
  if (task.statusId === toStatusId && task.position === position) return null;
  return { updates: [{ id: task.id, statusId: toStatusId, position }] };
}
