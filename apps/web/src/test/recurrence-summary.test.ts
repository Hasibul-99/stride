import { describe, it, expect } from 'vitest';
import { recurrenceSummary } from '@teamboard/shared';

describe('recurrenceSummary', () => {
  it('daily, interval 1', () => {
    expect(recurrenceSummary({ frequency: 'DAILY', interval: 1 })).toBe('Every day');
  });

  it('daily, interval > 1', () => {
    expect(recurrenceSummary({ frequency: 'DAILY', interval: 3 })).toBe('Every 3 days');
  });

  it('weekly with multiple weekdays, sorted', () => {
    expect(
      recurrenceSummary({ frequency: 'WEEKLY', interval: 2, byWeekdays: [3, 1] }),
    ).toBe('Every 2 weeks on Mon, Wed');
  });

  it('weekly without weekdays', () => {
    expect(recurrenceSummary({ frequency: 'WEEKLY', interval: 1, byWeekdays: [] })).toBe('Every week');
  });

  it('monthly, interval > 1', () => {
    expect(recurrenceSummary({ frequency: 'MONTHLY', interval: 2 })).toBe('Every 2 months');
  });

  it('appends count when set', () => {
    expect(
      recurrenceSummary({ frequency: 'WEEKLY', interval: 1, byWeekdays: [1], count: 5 }),
    ).toBe('Every week on Mon, 5 times');
  });

  it('appends until date (and prefers until over count)', () => {
    expect(
      recurrenceSummary({
        frequency: 'DAILY',
        interval: 1,
        until: '2026-07-01T00:00:00.000Z',
        count: 5,
      }),
    ).toBe('Every day until 2026-07-01');
  });
});
