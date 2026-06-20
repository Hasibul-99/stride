import { WORKLOAD_AMBER_MINUTES, WORKLOAD_RED_MINUTES } from './constants.js';

export type WorkloadTier = 'normal' | 'amber' | 'red';

/** Over-capacity tier: amber > 8h, red > 10h (thresholds from constants). */
export function workloadTier(minutes: number): WorkloadTier {
  if (minutes > WORKLOAD_RED_MINUTES) return 'red';
  if (minutes > WORKLOAD_AMBER_MINUTES) return 'amber';
  return 'normal';
}

/** Event duration in whole minutes (clamped at 0). */
export function eventDurationMinutes(startAt: string | Date, endAt: string | Date): number {
  const start = typeof startAt === 'string' ? new Date(startAt) : startAt;
  const end = typeof endAt === 'string' ? new Date(endAt) : endAt;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

/** Total planned minutes for a day: sum of task estimates + event durations. */
export function dayLoadMinutes(
  tasks: { timeEstimateMinutes?: number | null }[],
  events: { startAt: string | Date; endAt: string | Date }[] = [],
): number {
  const taskMin = tasks.reduce((sum, t) => sum + (t.timeEstimateMinutes ?? 0), 0);
  const eventMin = events.reduce((sum, e) => sum + eventDurationMinutes(e.startAt, e.endAt), 0);
  return taskMin + eventMin;
}
