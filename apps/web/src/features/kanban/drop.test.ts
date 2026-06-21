import { describe, it, expect } from 'vitest';
import { kanbanMovePayload } from './drop';

const task = { id: 't1', statusId: 's_new', position: 1000 };

describe('kanbanMovePayload (drag outcome → bulk-positions body)', () => {
  it('moving to another column includes the new statusId, same task id', () => {
    const payload = kanbanMovePayload(task, [5000], 's_prog', 1);
    expect(payload).toEqual({ updates: [{ id: 't1', statusId: 's_prog', position: 6000 }] });
  });

  it('dropping into the Completed column sends the completed status id', () => {
    // The server stamps completedAt when it receives an isCompleted statusId.
    const payload = kanbanMovePayload(task, [], 's_done', 0);
    expect(payload?.updates[0].statusId).toBe('s_done');
  });

  it('reordering within the same column keeps the statusId, new position', () => {
    // Insert between positions 1000 and 2000 → midpoint 1500.
    const payload = kanbanMovePayload(task, [1000, 2000], 's_new', 1);
    expect(payload).toEqual({ updates: [{ id: 't1', statusId: 's_new', position: 1500 }] });
  });

  it('is a no-op when status and position are unchanged', () => {
    // Dropping back where it was (empty dest → positionForIndex([],0) = 1000).
    expect(kanbanMovePayload(task, [], 's_new', 0)).toBeNull();
  });
});
