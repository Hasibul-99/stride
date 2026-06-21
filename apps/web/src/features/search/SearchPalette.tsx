import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { SearchResults } from '@teamboard/shared';
import { api } from '@/lib/api';
import { useWorkspaceStore } from '@/store/workspace.store';

export function SearchPalette() {
  const navigate = useNavigate();
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspaceId) ?? undefined;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else setQ('');
  }, [open]);

  const { data } = useQuery({
    queryKey: ['search', workspaceId, q],
    enabled: open && !!workspaceId && q.trim().length > 0,
    queryFn: async () =>
      (await api.get<SearchResults>(`/workspaces/${workspaceId}/search`, { params: { q } })).data,
  });

  if (!open) return null;

  function go(projectId: string) {
    navigate(`/app/projects/${projectId}`);
    setOpen(false);
  }

  // Enter opens the first result (tasks first, then notes).
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return;
    const first = data?.tasks[0] ?? data?.notes[0];
    if (first) go(first.projectId);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/30 p-4 pt-[15vh]" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="w-full max-w-lg overflow-hidden rounded-modal border border-border bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search tasks and notes…"
          className="w-full border-b border-border bg-surface px-4 py-3 outline-none"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {data?.tasks.length === 0 && data?.notes.length === 0 && q && (
            <p className="px-2 py-3 text-sm text-muted">No results.</p>
          )}
          {data?.tasks.map((t) => (
            <button key={t.id} onClick={() => go(t.projectId)} className="block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-background">
              <span className="text-muted">Task ·</span> {t.title}
              <span className="text-xs text-muted"> — {t.projectName}</span>
            </button>
          ))}
          {data?.notes.map((n) => (
            <button key={n.id} onClick={() => go(n.projectId)} className="block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-background">
              <span className="text-muted">Note ·</span> {n.title}
              <span className="text-xs text-muted"> — {n.projectName}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
