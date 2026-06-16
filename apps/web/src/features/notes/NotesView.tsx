import { useEffect, useState } from 'react';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { connectSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/auth.store';
import { useCreateNote, useDeleteNote, useNotes } from './api';
import { NoteEditor } from './NoteEditor';

export function NotesView({ projectId }: { projectId: string }) {
  const { data: notes } = useNotes(projectId);
  const create = useCreateNote(projectId);
  const del = useDeleteNote(projectId);
  const myId = useAuthStore((s) => s.user?.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [staleBanner, setStaleBanner] = useState(false);

  const selected = notes?.find((n) => n.id === selectedId) ?? notes?.[0];

  // Conflict-safety banner: another user edited the open note.
  useEffect(() => {
    const socket = connectSocket();
    const onBoard = (p: { noteUpdated?: { id: string; by: string } }) => {
      if (p.noteUpdated && p.noteUpdated.id === selected?.id && p.noteUpdated.by !== myId) {
        setStaleBanner(true);
      }
    };
    socket.on(SOCKET_EVENTS.boardChanged, onBoard);
    return () => {
      socket.off(SOCKET_EVENTS.boardChanged, onBoard);
    };
  }, [selected?.id, myId]);

  useEffect(() => setStaleBanner(false), [selected?.id]);

  return (
    <div className="flex h-full gap-4">
      <div className="flex w-56 shrink-0 flex-col rounded-card border border-border">
        <button
          onClick={async () => {
            const n = await create.mutateAsync({ title: 'Untitled' });
            setSelectedId(n.id);
          }}
          className="border-b border-border px-3 py-2 text-left text-sm text-primary"
        >
          + New note
        </button>
        <div className="flex-1 overflow-y-auto">
          {notes?.map((n) => (
            <div
              key={n.id}
              className={`group flex items-center gap-1 px-3 py-2 text-sm ${
                selected?.id === n.id ? 'bg-background font-medium' : ''
              }`}
            >
              <button onClick={() => setSelectedId(n.id)} className="min-w-0 flex-1 truncate text-left">
                {n.title}
              </button>
              <button
                onClick={() => del.mutate(n.id)}
                className="text-muted opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          ))}
          {notes && notes.length === 0 && <p className="px-3 py-2 text-sm text-muted">No notes.</p>}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {staleBanner && (
          <div className="mb-2 flex items-center justify-between rounded-control bg-amber-500/10 px-3 py-1.5 text-sm text-amber-700">
            Updated by someone else — refresh to see changes.
            <button onClick={() => window.location.reload()} className="font-medium underline">
              Refresh
            </button>
          </div>
        )}
        {selected ? (
          <NoteEditor key={selected.id} projectId={projectId} note={selected} />
        ) : (
          <p className="text-muted">Select or create a note.</p>
        )}
      </div>
    </div>
  );
}
