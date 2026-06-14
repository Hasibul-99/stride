import { cn } from '@/lib/utils';

interface Props {
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({ name, avatarUrl, size = 20, className }: Props) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className={cn('rounded-full object-cover', className)}
      />
    );
  }
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-background font-medium text-muted',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
