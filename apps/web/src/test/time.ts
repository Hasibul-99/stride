import { vi } from 'vitest';

/**
 * Freeze the clock at a fixed instant for deterministic time-based tests.
 * Returns a restore() fn. Default: 2026-06-15T12:00:00Z (a Monday).
 */
export function freezeTime(iso = '2026-06-15T12:00:00.000Z') {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  return () => vi.useRealTimers();
}

/**
 * Pin the process timezone (affects date-fns/Intl) for timezone-sensitive tests.
 * Call before importing/rendering code that reads the local zone.
 * Returns a restore() fn. Default: America/New_York.
 */
export function pinTimezone(tz = 'America/New_York') {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  return () => {
    process.env.TZ = previous;
  };
}
