import { dayLoadMinutes, formatMinutes, workloadTier } from '@teamboard/shared';
import { cn } from '@/lib/utils';

interface Props {
  tasks: { timeEstimateMinutes?: number | null }[];
  events?: { startAt: string; endAt: string }[];
}

const TIER_CLASS = {
  normal: 'text-muted',
  amber: 'text-warning',
  red: 'text-danger',
} as const;

/** Per-day workload total; colors by over-capacity tier (amber > 8h, red > 10h). */
export function WorkloadFooter({ tasks, events = [] }: Props) {
  const minutes = dayLoadMinutes(tasks, events);
  if (minutes <= 0) return null;
  const tier = workloadTier(minutes);
  return (
    <span data-tier={tier} className={cn('text-xs tabular-nums', TIER_CLASS[tier])}>
      {formatMinutes(minutes)}
    </span>
  );
}
