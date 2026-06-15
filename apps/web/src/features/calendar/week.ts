import { addDays, addWeeks, format, isSameDay, parseISO, startOfWeek } from 'date-fns';

export interface WeekDay {
  date: Date;
  iso: string; // YYYY-MM-DD
  label: string; // Mon
  dayNum: string; // 14
  isToday: boolean;
}

export function weekStart(ref: Date): Date {
  return startOfWeek(ref, { weekStartsOn: 1 }); // Monday
}

export function shiftWeeks(ref: Date, delta: number): Date {
  return addWeeks(ref, delta);
}

export function buildWeek(start: Date): WeekDay[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return {
      date,
      iso: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEE'),
      dayNum: format(date, 'd'),
      isToday: isSameDay(date, today),
    };
  });
}

export function isoToDate(iso: string): Date {
  return parseISO(iso);
}

export function rangeOf(week: WeekDay[]): { from: string; to: string } {
  return { from: week[0].iso, to: week[6].iso };
}
