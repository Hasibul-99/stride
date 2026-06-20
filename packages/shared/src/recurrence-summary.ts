import type { RecurrenceFrequency } from './constants.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface RecurrenceSummaryRule {
  frequency: RecurrenceFrequency;
  interval: number;
  byWeekdays?: number[];
  until?: string | Date | null;
  count?: number | null;
}

/** Human-readable recurrence summary, e.g. "Every 2 weeks on Mon, Wed". */
export function recurrenceSummary(rule: RecurrenceSummaryRule): string {
  const n = Math.max(1, rule.interval);
  const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month' }[rule.frequency];
  let base = n === 1 ? `Every ${unit}` : `Every ${n} ${unit}s`;

  if (rule.frequency === 'WEEKLY' && rule.byWeekdays && rule.byWeekdays.length > 0) {
    const days = [...rule.byWeekdays].sort((a, b) => a - b).map((d) => WEEKDAYS[d]);
    base += ` on ${days.join(', ')}`;
  }

  // `until` and `count` are mutually exclusive ends.
  if (rule.until) {
    const d = typeof rule.until === 'string' ? new Date(rule.until) : rule.until;
    base += ` until ${d.toISOString().slice(0, 10)}`;
  } else if (rule.count) {
    base += `, ${rule.count} times`;
  }

  return base;
}
