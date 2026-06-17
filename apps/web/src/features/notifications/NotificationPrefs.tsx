import { useQuery, useQueryClient } from '@tanstack/react-query';
import { HIGH_VALUE_NOTIF_TYPES } from '@teamboard/shared';
import { api } from '@/lib/api';

interface Prefs {
  emailNotifications: boolean;
  prefs: Record<string, { inApp?: boolean; email?: boolean }>;
}

const TYPES = [...HIGH_VALUE_NOTIF_TYPES, 'EVENT_REMINDER', 'CHAT_MESSAGE'];
const LABELS: Record<string, string> = {
  TASK_ASSIGNED: 'Task assigned',
  MENTION: 'Mention',
  INVITE: 'Invite',
  EVENT_REMINDER: 'Event reminder',
  CHAT_MESSAGE: 'Chat message',
};

export function NotificationPrefs() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notif-prefs'],
    queryFn: async () => (await api.get<Prefs>('/notifications/preferences')).data,
  });

  async function save(next: Partial<Prefs>) {
    await api.patch('/notifications/preferences', next);
    qc.invalidateQueries({ queryKey: ['notif-prefs'] });
  }

  if (!data) return <p className="text-sm text-muted">Loading…</p>;

  const get = (type: string, ch: 'inApp' | 'email') => data.prefs[type]?.[ch] !== false;

  function toggle(type: string, ch: 'inApp' | 'email') {
    const prefs = { ...data!.prefs, [type]: { ...data!.prefs[type], [ch]: !get(type, ch) } };
    save({ prefs });
  }

  return (
    <div>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.emailNotifications}
          onChange={(e) => save({ emailNotifications: e.target.checked })}
        />
        Email notifications (master switch)
      </label>

      <table className="text-sm">
        <thead className="text-muted">
          <tr>
            <th className="py-1 pr-6 text-left font-medium">Type</th>
            <th className="px-3 font-medium">In-app</th>
            <th className="px-3 font-medium">Email</th>
          </tr>
        </thead>
        <tbody>
          {TYPES.map((t) => (
            <tr key={t}>
              <td className="py-1 pr-6">{LABELS[t] ?? t}</td>
              <td className="px-3 text-center">
                <input type="checkbox" checked={get(t, 'inApp')} onChange={() => toggle(t, 'inApp')} />
              </td>
              <td className="px-3 text-center">
                <input type="checkbox" checked={get(t, 'email')} onChange={() => toggle(t, 'email')} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
