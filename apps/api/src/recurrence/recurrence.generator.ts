import { RecurrenceFrequency } from '@prisma/client';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  byWeekdays: number[]; // 0=Sun..6=Sat
  until?: Date | null;
  count?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function addMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

function startOfWeekSun(d: Date): Date {
  return addDays(d, -d.getUTCDay());
}

/**
 * Generate occurrence start datetimes for a recurrence rule, from `base`
 * (the first occurrence) up to `horizonEnd`, honouring until/count limits.
 * Pure + deterministic. Times-of-day come from `base`.
 */
export function generateOccurrences(rule: RecurrenceRule, base: Date, horizonEnd: Date): Date[] {
  const out: Date[] = [];
  const interval = Math.max(1, rule.interval);
  const limit = rule.count ?? Infinity;
  const until = rule.until ?? null;

  const push = (d: Date): boolean => {
    if (d < base) return true;
    if (until && d > until) return false;
    if (d > horizonEnd) return false;
    if (out.length >= limit) return false;
    out.push(d);
    return out.length < limit;
  };

  const guard = 5000; // safety against runaway loops
  let steps = 0;

  if (rule.frequency === 'DAILY') {
    let cur = base;
    while (cur <= horizonEnd && steps++ < guard) {
      if (!push(cur)) break;
      cur = addDays(cur, interval);
    }
  } else if (rule.frequency === 'WEEKLY') {
    const weekdays = rule.byWeekdays.length ? [...rule.byWeekdays].sort((a, b) => a - b) : [base.getUTCDay()];
    const hours = base.getUTCHours();
    const mins = base.getUTCMinutes();
    let weekStart = startOfWeekSun(base);
    while (weekStart <= horizonEnd && steps++ < guard) {
      for (const wd of weekdays) {
        const occ = addDays(weekStart, wd);
        occ.setUTCHours(hours, mins, 0, 0);
        if (occ > horizonEnd) break;
        if (occ >= base) {
          if (until && occ > until) return out;
          if (out.length >= limit) return out;
          out.push(occ);
        }
      }
      weekStart = addDays(weekStart, 7 * interval);
    }
  } else {
    // MONTHLY: same day-of-month each `interval` months.
    let cur = base;
    while (cur <= horizonEnd && steps++ < guard) {
      if (!push(cur)) break;
      cur = addMonths(cur, interval);
    }
  }

  return out;
}
