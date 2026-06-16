import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full rounded-control border border-border bg-surface px-3 text-base outline-none placeholder:text-muted focus:border-primary',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
