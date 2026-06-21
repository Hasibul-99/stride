import { FormEvent, useState } from 'react';
import { PROJECT_COLORS, type ProjectColor } from '@teamboard/shared';
import { COLOR_HEX } from './colors';
import { useCreateProject, type Folder } from './api';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { cn } from '@/lib/utils';

interface Props {
  workspaceId: string;
  folders: Folder[];
  onClose: () => void;
}

export function CreateProjectModal({ workspaceId, folders, onClose }: Props) {
  const create = useCreateProject(workspaceId);
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);
  const [name, setName] = useState('');
  const [color, setColor] = useState<ProjectColor>('blue');
  const [folderId, setFolderId] = useState<string>('');
  const [description, setDescription] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync({
      name: name.trim(),
      color,
      description: description.trim() || null,
      folderId: folderId || null,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="New project"
        tabIndex={-1}
        className="w-full max-w-md rounded-modal border border-border bg-surface p-6 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">New project</h2>
        <form className="space-y-4" onSubmit={onSubmit}>
          <input
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />

          <div>
            <div className="mb-1.5 text-sm text-muted">Color</div>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{ background: COLOR_HEX[c] }}
                  className={cn(
                    'h-6 w-6 rounded-full ring-offset-2 ring-offset-surface',
                    color === c && 'ring-2 ring-foreground',
                  )}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          {folders.length > 0 && (
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          )}

          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-control border border-border px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending || !name.trim()}
              className="rounded-control bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {create.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
