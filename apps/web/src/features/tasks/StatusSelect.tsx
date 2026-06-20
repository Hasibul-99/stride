import { COLOR_HEX } from '@/features/workspaces/colors';
import type { TaskStatus } from './api';

export function StatusBadge({ status }: { status: Pick<TaskStatus, 'name' | 'color'> }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        data-testid="status-dot"
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: COLOR_HEX[status.color] }}
      />
      {status.name}
    </span>
  );
}

interface SelectProps {
  statuses: TaskStatus[];
  value: string;
  onChange: (statusId: string) => void;
  label?: string;
}

/** Accessible status picker listing the project's custom statuses. */
export function StatusSelect({ statuses, value, onChange, label = 'Status' }: SelectProps) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
    >
      {statuses.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.isCompleted ? ' ✓' : ''}
        </option>
      ))}
    </select>
  );
}
