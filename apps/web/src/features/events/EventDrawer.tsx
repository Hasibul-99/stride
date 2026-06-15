import { format } from 'date-fns';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { Avatar } from '@/components/ui/Avatar';
import { useDeleteEvent, type CalEvent } from './api';
import { cn } from '@/lib/utils';

const RSVP_STYLE: Record<string, string> = {
  ACCEPTED: 'text-green-600',
  DECLINED: 'text-red-600',
  PENDING: 'text-muted',
};

export function EventDrawer({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const del = useDeleteEvent();

  return (
    <div className="fixed inset-0 z-40" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20" />
      <aside
        className="absolute right-0 top-0 flex h-full w-[400px] flex-col gap-4 overflow-y-auto border-l border-border bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="text-muted hover:text-foreground">← Close</button>
          <button
            onClick={async () => {
              await del.mutateAsync(event.id);
              onClose();
            }}
            className="text-sm text-red-600"
          >
            Delete
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[event.color] }} />
          <h2 className="text-lg font-semibold">{event.title}</h2>
        </div>

        <div className="text-sm text-muted">
          {format(new Date(event.startAt), 'EEE d MMM, HH:mm')} – {format(new Date(event.endAt), 'HH:mm')}
        </div>
        {event.location && <div className="text-sm">📍 {event.location}</div>}
        {event.recurrenceId && <div className="text-xs text-muted">🔁 Recurring</div>}
        {event.description && <p className="text-sm">{event.description}</p>}

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Participants
          </div>
          <div className="space-y-1.5">
            {event.participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <Avatar name={p.user?.name ?? p.email ?? '?'} avatarUrl={p.user?.avatarUrl} />
                <span className="flex-1 truncate">{p.user?.name ?? p.email}</span>
                <span className={cn('text-xs', RSVP_STYLE[p.responseStatus])}>
                  {p.responseStatus.toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
