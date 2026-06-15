import { cn } from '@/lib/utils';

interface Props<T extends string> {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}

export function Tabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div className="flex gap-1 rounded-control border border-border bg-surface p-0.5">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'rounded-[4px] px-3 py-1 text-sm transition',
            active === t.id ? 'bg-background font-medium' : 'text-muted hover:text-foreground',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
