import { ReactNode } from 'react';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { cn } from '@/lib/utils';

export function Modal({
  onClose,
  children,
  className,
  label = 'Dialog',
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label?: string;
}) {
  const ref = useFocusTrap<HTMLDivElement>(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-lg outline-none',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
