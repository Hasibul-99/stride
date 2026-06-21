import { describe, it, expect } from 'vitest';
import { calendarMovePayload, WAITING } from './drop';

const scheduled = { id: 't1', scheduledDate: '2026-06-15', position: 1000 };
const waiting = { id: 't2', scheduledDate: null, position: 1000 };

describe('calendarMovePayload (drag outcome → bulk-positions body)', () => {
  it('moving a task to another day sets the new scheduledDate', () => {
    const payload = calendarMovePayload(scheduled, [], '2026-06-18', 0);
    expect(payload).toEqual({ updates: [{ id: 't1', scheduledDate: '2026-06-18', position: 1000 }] });
  });

  it('moving a scheduled task to the waiting list nulls scheduledDate', () => {
    const payload = calendarMovePayload(scheduled, [], WAITING, 0);
    expect(payload).toEqual({ updates: [{ id: 't1', scheduledDate: null, position: 1000 }] });
  });

  it('scheduling a waiting-list task onto a day sets the date', () => {
    const payload = calendarMovePayload(waiting, [], '2026-06-16', 0);
    expect(payload).toEqual({ updates: [{ id: 't2', scheduledDate: '2026-06-16', position: 1000 }] });
  });

  it('reordering within the same day keeps the date, new position', () => {
    const payload = calendarMovePayload(scheduled, [1000, 2000], '2026-06-15', 1);
    expect(payload).toEqual({ updates: [{ id: 't1', scheduledDate: '2026-06-15', position: 1500 }] });
  });

  it('is a no-op when date and position are unchanged', () => {
    expect(calendarMovePayload(scheduled, [], '2026-06-15', 0)).toBeNull();
  });
});
