import { useToastStore } from '@/store/toast.store';
import { cn } from '@/lib/utils';

const TONE: Record<string, string> = {
  error: 'border-danger/40 bg-danger-tint text-danger',
  success: 'border-success/40 bg-success-tint text-success',
  info: 'border-border bg-surface text-foreground',
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={cn('rounded-control border px-4 py-2 text-sm shadow-md', TONE[t.tone])}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
