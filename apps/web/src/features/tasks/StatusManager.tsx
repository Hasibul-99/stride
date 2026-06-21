import { useState } from 'react';
import { PROJECT_COLORS, type ProjectColor } from '@teamboard/shared';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { useFocusTrap } from '@/lib/useFocusTrap';
import { cn } from '@/lib/utils';
import {
  useCreateStatus,
  useDeleteStatus,
  useStatuses,
  useUpdateStatus,
  type TaskStatus,
} from './api';

export function StatusManager({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const { data: statuses } = useStatuses(projectId);
  const create = useCreateStatus(projectId);
  const dialogRef = useFocusTrap<HTMLDivElement>(onClose);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<ProjectColor>('slate');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Manage statuses"
        tabIndex={-1}
        className="w-full max-w-lg rounded-modal border border-border bg-surface p-6 shadow-lg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Manage statuses</h2>

        <div className="space-y-2">
          {statuses?.map((s) => (
            <StatusRow key={s.id} projectId={projectId} status={s} all={statuses} />
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Add status
          </div>
          <div className="flex items-center gap-2">
            <ColorPicker value={newColor} onChange={setNewColor} />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Status name"
              className="flex-1 rounded-control border border-border bg-surface px-3 py-2 outline-none focus:border-primary"
            />
            <button
              disabled={!newName.trim() || create.isPending}
              onClick={async () => {
                await create.mutateAsync({ name: newName.trim(), color: newColor, isCompleted: false });
                setNewName('');
              }}
              className="rounded-control bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              Add
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onClose} className="rounded-control border border-border px-3 py-2 text-sm">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  projectId,
  status,
  all,
}: {
  projectId: string;
  status: TaskStatus;
  all: TaskStatus[];
}) {
  const update = useUpdateStatus(projectId);
  const del = useDeleteStatus(projectId);
  const [name, setName] = useState(status.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [target, setTarget] = useState('');

  const others = all.filter((s) => s.id !== status.id);

  return (
    <div className="flex items-center gap-2 rounded-control border border-border px-2 py-1.5">
      <ColorPicker
        value={status.color}
        onChange={(c) => update.mutate({ id: status.id, color: c })}
      />
      <input
        aria-label="Status name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== status.name && update.mutate({ id: status.id, name: name.trim() })}
        className="flex-1 bg-transparent outline-none"
      />
      <label className="flex items-center gap-1 text-xs text-muted">
        <input
          type="checkbox"
          checked={status.isCompleted}
          onChange={(e) => update.mutate({ id: status.id, isCompleted: e.target.checked })}
        />
        done
      </label>

      {!confirmingDelete ? (
        <button
          onClick={() => setConfirmingDelete(true)}
          className="text-xs text-red-600"
          disabled={others.length === 0}
        >
          delete
        </button>
      ) : (
        <span className="flex items-center gap-1">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
          >
            <option value="">move to…</option>
            {others.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            disabled={!target}
            onClick={() => del.mutate({ id: status.id, targetStatusId: target })}
            className="text-xs text-red-600 disabled:opacity-50"
          >
            ✓
          </button>
          <button onClick={() => setConfirmingDelete(false)} className="text-xs text-muted">
            ✕
          </button>
        </span>
      )}
    </div>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: ProjectColor;
  onChange: (c: ProjectColor) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ background: COLOR_HEX[value] }}
        className="h-5 w-5 rounded-full"
        aria-label="color"
      />
      {open && (
        <span className="absolute z-10 mt-1 flex w-40 flex-wrap gap-1 rounded-control border border-border bg-surface p-2 shadow">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              aria-label={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              style={{ background: COLOR_HEX[c] }}
              className={cn('h-5 w-5 rounded-full', c === value && 'ring-2 ring-foreground')}
            />
          ))}
        </span>
      )}
    </span>
  );
}
