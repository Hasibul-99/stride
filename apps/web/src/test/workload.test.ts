import { describe, it, expect } from 'vitest';
import { dayLoadMinutes, eventDurationMinutes, workloadTier } from '@teamboard/shared';
import { makeTask, makeEvent } from './factories';

describe('eventDurationMinutes', () => {
  it('computes minutes between start and end', () => {
    expect(eventDurationMinutes('2026-06-15T10:00:00Z', '2026-06-15T11:30:00Z')).toBe(90);
  });
  it('clamps negative ranges to 0', () => {
    expect(eventDurationMinutes('2026-06-15T11:00:00Z', '2026-06-15T10:00:00Z')).toBe(0);
  });
});

describe('dayLoadMinutes', () => {
  it('sums task estimates + event durations', () => {
    const tasks = [makeTask({ timeEstimateMinutes: 60 }), makeTask({ timeEstimateMinutes: 30 })];
    const events = [makeEvent({ startAt: '2026-06-15T10:00:00Z', endAt: '2026-06-15T11:00:00Z' })];
    expect(dayLoadMinutes(tasks, events)).toBe(150); // 60 + 30 + 60
  });

  it('ignores tasks without estimates and works with no events', () => {
    expect(dayLoadMinutes([makeTask({ timeEstimateMinutes: null }), makeTask({ timeEstimateMinutes: 45 })])).toBe(45);
  });
});

describe('workloadTier (amber > 8h, red > 10h)', () => {
  it.each([
    [0, 'normal'],
    [480, 'normal'], // exactly 8h
    [481, 'amber'], // just over 8h
    [600, 'amber'], // exactly 10h
    [601, 'red'], // just over 10h
    [720, 'red'],
  ])('%i minutes → %s', (minutes, tier) => {
    expect(workloadTier(minutes)).toBe(tier);
  });
});
