import { generateOccurrences } from './recurrence.generator';

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe('generateOccurrences', () => {
  it('daily every 2 days, count 3', () => {
    const base = new Date('2026-01-01T09:00:00.000Z');
    const occ = generateOccurrences(
      { frequency: 'DAILY', interval: 2, byWeekdays: [], count: 3 },
      base,
      new Date('2026-02-01T00:00:00.000Z'),
    );
    expect(occ.map(iso)).toEqual(['2026-01-01', '2026-01-03', '2026-01-05']);
  });

  it('weekly on Mon+Wed, interval 1', () => {
    // 2026-01-01 is a Thursday.
    const base = new Date('2026-01-01T10:00:00.000Z');
    const occ = generateOccurrences(
      { frequency: 'WEEKLY', interval: 1, byWeekdays: [1, 3] }, // Mon, Wed
      base,
      new Date('2026-01-15T00:00:00.000Z'),
    );
    // First Mon after base = Jan 5, Wed = Jan 7, then Jan 12, Jan 14.
    expect(occ.map(iso)).toEqual(['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14']);
  });

  it('weekly interval 2 skips a week', () => {
    const base = new Date('2026-01-05T10:00:00.000Z'); // Monday
    const occ = generateOccurrences(
      { frequency: 'WEEKLY', interval: 2, byWeekdays: [1] },
      base,
      new Date('2026-02-15T00:00:00.000Z'),
    );
    expect(occ.map(iso)).toEqual(['2026-01-05', '2026-01-19', '2026-02-02']);
  });

  it('respects until', () => {
    const base = new Date('2026-01-01T09:00:00.000Z');
    const occ = generateOccurrences(
      { frequency: 'DAILY', interval: 1, byWeekdays: [], until: new Date('2026-01-03T23:59:59.000Z') },
      base,
      new Date('2026-03-01T00:00:00.000Z'),
    );
    expect(occ.map(iso)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });

  it('monthly same day-of-month, count 3', () => {
    const base = new Date('2026-01-15T08:00:00.000Z');
    const occ = generateOccurrences(
      { frequency: 'MONTHLY', interval: 1, byWeekdays: [], count: 3 },
      base,
      new Date('2026-12-31T00:00:00.000Z'),
    );
    expect(occ.map(iso)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
  });

  it('stops at horizon', () => {
    const base = new Date('2026-01-01T09:00:00.000Z');
    const occ = generateOccurrences(
      { frequency: 'DAILY', interval: 1, byWeekdays: [] },
      base,
      new Date('2026-01-05T23:59:59.000Z'),
    );
    expect(occ.map(iso)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05']);
  });
});
