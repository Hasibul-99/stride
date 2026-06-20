import { describe, it, expect } from 'vitest';
import { parseDurationToMinutes, formatMinutes } from '@teamboard/shared';

describe('parseDurationToMinutes', () => {
  it.each([
    ['1h 30m', 90],
    ['90m', 90],
    ['1.5h', 90],
    ['2h', 120],
    ['45', 45],
    ['45m', 45],
    ['  2h   15m ', 135],
    ['1H 30M', 90], // case-insensitive
    ['0', 0],
  ])('parses %j → %i minutes', (input, expected) => {
    expect(parseDurationToMinutes(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', 'soon', 'h', 'm'])('returns null for bad input %j', (input) => {
    expect(parseDurationToMinutes(input)).toBeNull();
  });
});

describe('formatMinutes', () => {
  it.each([
    [90, '1h 30m'],
    [60, '1h'],
    [45, '45m'],
    [120, '2h'],
    [0, ''],
  ])('formats %i minutes → %j', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it('treats null/undefined/negative as empty', () => {
    expect(formatMinutes(null)).toBe('');
    expect(formatMinutes(undefined)).toBe('');
    expect(formatMinutes(-30)).toBe('');
  });

  it('round-trips parse → format', () => {
    expect(formatMinutes(parseDurationToMinutes('1h 30m'))).toBe('1h 30m');
  });
});
