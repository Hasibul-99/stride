import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Modal({
  onClose,
  children,
  className,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-lg',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
