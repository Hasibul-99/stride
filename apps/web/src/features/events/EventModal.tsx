import { FormEvent, useState } from 'react';
import {
  PROJECT_COLORS,
  RECURRENCE_FREQUENCIES,
  type ProjectColor,
  type RecurrenceFrequency,
} from '@teamboard/shared';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { useProjectMembers } from '@/features/tasks/api';
import { useCreateEvent } from './api';
import { cn } from '@/lib/utils';

interface Props {
  projectId?: string | null;
  defaultDate?: string; // YYYY-MM-DD
  onClose: () => void;
}

export function EventModal({ projectId, defaultDate, onClose }: Props) {
  const create = useCreateEvent();
  const { data: members } = useProjectMembers(projectId ?? undefined);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState<ProjectColor>('blue');
  const [reminder, setReminder] = useState('15');
  const [userIds, setUserIds] = useState<Set<string>>(new Set());
  const [emails, setEmails] = useState<string[]>([]);
  const [emailDraft, setEmailDraft] = useState('');
  const [freq, setFreq] = useState<RecurrenceFrequency | 'none'>('none');
  const [interval, setInterval] = useState('1');
  const [count, setCount] = useState('');

  function toggleUser(id: string) {
    setUserIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const startAt = new Date(`${date}T${start}:00`).toISOString();
    const endAt = new Date(`${date}T${end}:00`).toISOString();
    const participants = [
      ...[...userIds].map((userId) => ({ userId })),
      ...emails.map((email) => ({ email })),
    ];
    await create.mutateAsync({
      projectId: projectId ?? null,
      title: title.trim(),
      startAt,
      endAt,
      allDay: false,
      location: location.trim() || null,
      color,
      reminderMinutesBefore: reminder ? Number(reminder) : null,
      participants,
      recurrence:
        freq === 'none'
          ? null
          : {
              frequency: freq,
              interval: Number(interval) || 1,
              byWeekdays: [],
              count: count ? Number(count) : null,
            },
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">New event</h2>
        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            autoFocus
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1 rounded-control border border-border bg-surface px-2 py-2" />
            <input type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} className="rounded-control border border-border bg-surface px-2 py-2" />
            <input type="time" step={900} value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-control border border-border bg-surface px-2 py-2" />
          </div>
          <input
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Color</span>
            <div className="flex flex-wrap gap-1.5">
              {PROJECT_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  style={{ background: COLOR_HEX[c] }}
                  className={cn('h-5 w-5 rounded-full', c === color && 'ring-2 ring-foreground')}
                />
              ))}
            </div>
          </div>

          {members && members.length > 0 && (
            <div>
              <div className="mb-1 text-sm text-muted">Participants</div>
              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => (
                  <button
                    type="button"
                    key={m.user.id}
                    onClick={() => toggleUser(m.user.id)}
                    className={cn(
                      'rounded-full border px-2 py-0.5 text-xs',
                      userIds.has(m.user.id) ? 'border-primary bg-primary/10' : 'border-border',
                    )}
                  >
                    {m.user.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-1 flex flex-wrap gap-1.5">
              {emails.map((e) => (
                <span key={e} className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs">
                  {e}
                  <button type="button" onClick={() => setEmails((p) => p.filter((x) => x !== e))}>×</button>
                </span>
              ))}
            </div>
            <input
              placeholder="Invite by email (Enter)"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const v = emailDraft.trim();
                  if (v && /.+@.+\..+/.test(v)) {
                    setEmails((p) => [...new Set([...p, v])]);
                    setEmailDraft('');
                  }
                }
              }}
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Remind</span>
            <select value={reminder} onChange={(e) => setReminder(e.target.value)} className="rounded-control border border-border bg-surface px-2 py-1">
              <option value="">Off</option>
              <option value="10">10m before</option>
              <option value="15">15m before</option>
              <option value="30">30m before</option>
              <option value="60">1h before</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Repeat</span>
            <select value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceFrequency | 'none')} className="rounded-control border border-border bg-surface px-2 py-1">
              <option value="none">Never</option>
              {RECURRENCE_FREQUENCIES.map((f) => (
                <option key={f} value={f}>{f.toLowerCase()}</option>
              ))}
            </select>
            {freq !== 'none' && (
              <>
                <span className="text-muted">every</span>
                <input value={interval} onChange={(e) => setInterval(e.target.value)} className="w-12 rounded-control border border-border bg-surface px-2 py-1" />
                <input placeholder="× times" value={count} onChange={(e) => setCount(e.target.value)} className="w-20 rounded-control border border-border bg-surface px-2 py-1" />
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-control border border-border px-3 py-2 text-sm">Cancel</button>
            <button type="submit" disabled={create.isPending || !title.trim()} className="rounded-control bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
