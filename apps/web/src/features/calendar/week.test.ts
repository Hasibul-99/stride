import { describe, it, expect, afterEach } from 'vitest';
import { buildWeek, weekStart, shiftWeeks, rangeOf, isoToDate } from './week';
import { freezeTime } from '@/test/time';

// Suite runs in America/New_York (vitest.config env.TZ).
// 2026-06-15T12:00:00Z = 08:00 EDT on Monday June 15.

let restore: (() => void) | undefined;
afterEach(() => restore?.());

describe('week helpers', () => {
  it('weekStart snaps to Monday', () => {
    restore = freezeTime('2026-06-17T12:00:00.000Z'); // a Wednesday
    const start = weekStart(new Date());
    const days = buildWeek(start);
    expect(days[0].label).toBe('Mon');
    expect(days[0].dayNum).toBe('15');
  });

  it('builds 7 consecutive days Mon→Sun', () => {
    restore = freezeTime('2026-06-15T12:00:00.000Z');
    const days = buildWeek(weekStart(new Date()));
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(days.map((d) => d.iso)).toEqual([
      '2026-06-15', '2026-06-16', '2026-06-17', '2026-06-18', '2026-06-19', '2026-06-20', '2026-06-21',
    ]);
  });

  it('marks exactly one cell as today', () => {
    restore = freezeTime('2026-06-17T12:00:00.000Z');
    const days = buildWeek(weekStart(new Date()));
    const today = days.filter((d) => d.isToday);
    expect(today).toHaveLength(1);
    expect(today[0].iso).toBe('2026-06-17');
  });

  it('rangeOf returns the Mon..Sun ISO bounds', () => {
    restore = freezeTime('2026-06-15T12:00:00.000Z');
    const { from, to } = rangeOf(buildWeek(weekStart(new Date())));
    expect(from).toBe('2026-06-15');
    expect(to).toBe('2026-06-21');
  });

  it('shiftWeeks moves by whole weeks', () => {
    restore = freezeTime('2026-06-15T12:00:00.000Z');
    const next = buildWeek(shiftWeeks(weekStart(new Date()), 1));
    expect(next[0].iso).toBe('2026-06-22');
  });

  it('isoToDate parses a YYYY-MM-DD back to a Date', () => {
    const d = isoToDate('2026-06-15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(5); // June (0-based)
    expect(d.getDate()).toBe(15);
  });
});
