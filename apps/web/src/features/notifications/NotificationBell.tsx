import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

const LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'assigned you a task',
  MENTION: 'mentioned you',
  EVENT_REMINDER: 'event reminder',
  CHAT_MESSAGE: 'new message',
};

export function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: ['notif-unread'],
    queryFn: async () => (await api.get<{ count: number }>('/notifications/unread-count')).data.count,
  });
  const list = useQuery({
    queryKey: ['notif-list'],
    enabled: open,
    queryFn: async () =>
      (await api.get<{ items: Notification[] }>('/notifications')).data.items,
  });

  useEffect(() => {
    const socket = connectSocket();
    const onNew = () => {
      qc.invalidateQueries({ queryKey: ['notif-unread'] });
      qc.invalidateQueries({ queryKey: ['notif-list'] });
    };
    socket.on(SOCKET_EVENTS.notificationNew, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.notificationNew, onNew);
    };
  }, [qc]);

  async function markAll() {
    await api.post('/notifications/read-all');
    qc.invalidateQueries({ queryKey: ['notif-unread'] });
    qc.invalidateQueries({ queryKey: ['notif-list'] });
  }

  async function openNotif(n: Notification) {
    await api.post(`/notifications/${n.id}/read`).catch(() => undefined);
    qc.invalidateQueries({ queryKey: ['notif-unread'] });
    qc.invalidateQueries({ queryKey: ['notif-list'] });
    setOpen(false);
    const projectId = n.payload.projectId;
    if (typeof projectId === 'string') navigate(`/app/projects/${projectId}`);
  }

  const count = unread.data ?? 0;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-full px-2 py-1 text-lg">
        🔔
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-modal border border-border bg-surface p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-medium">Notifications</span>
            <button onClick={markAll} className="text-xs text-primary">Mark all read</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {(list.data ?? []).map((n) => (
              <button
                key={n.id}
                onClick={() => openNotif(n)}
                className={`block w-full rounded-control px-2 py-1.5 text-left text-sm hover:bg-background ${n.readAt ? 'text-muted' : 'font-medium'}`}
              >
                <span>{LABELS[n.type] ?? n.type}</span>
                {typeof n.payload.title === 'string' && <span> · {n.payload.title}</span>}
                {typeof n.payload.from === 'string' && <span> · {n.payload.from}</span>}
                <div className="text-[11px] text-muted">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </div>
              </button>
            ))}
            {list.data && list.data.length === 0 && (
              <p className="px-2 py-3 text-sm text-muted">Nothing yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
