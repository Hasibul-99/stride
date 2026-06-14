import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useLogout, useMe } from '@/features/auth/api';
import { useWorkspaceStore } from '@/store/workspace.store';
import { useFolders, useProjects, useWorkspaces } from './api';
import { CreateProjectModal } from './CreateProjectModal';
import { COLOR_HEX } from './colors';

export function Sidebar() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const logout = useLogout();
  const { data: workspaces } = useWorkspaces();
  const { currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);

  // Default to the first workspace once loaded.
  useEffect(() => {
    if (!currentWorkspaceId && workspaces && workspaces.length > 0) {
      setCurrentWorkspace(workspaces[0].id);
    }
  }, [workspaces, currentWorkspaceId, setCurrentWorkspace]);

  const { data: folders } = useFolders(currentWorkspaceId ?? undefined);
  const { data: projects } = useProjects(currentWorkspaceId ?? undefined);

  const unfiled = projects?.filter((p) => !p.folderId) ?? [];

  async function onLogout() {
    await logout.mutateAsync();
    navigate('/auth/signin');
  }

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-surface">
      <div className="border-b border-border p-3">
        <select
          value={currentWorkspaceId ?? ''}
          onChange={(e) => setCurrentWorkspace(e.target.value)}
          className="w-full rounded-control border border-border bg-surface px-2 py-1.5 text-sm font-medium outline-none focus:border-primary"
        >
          {workspaces?.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <NavLink
          to="/app"
          end
          className={({ isActive }) =>
            `block rounded-control px-2 py-1.5 text-sm ${isActive ? 'bg-background font-medium' : 'text-muted'}`
          }
        >
          Calendar
        </NavLink>

        <div className="mt-4 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            Projects
          </span>
          <button
            onClick={() => setShowCreate(true)}
            className="text-muted hover:text-foreground"
            aria-label="New project"
            title="New project"
          >
            +
          </button>
        </div>

        {folders?.map((folder) => {
          const inFolder = projects?.filter((p) => p.folderId === folder.id) ?? [];
          return (
            <div key={folder.id} className="mt-2">
              <div className="px-2 text-xs font-medium text-muted">{folder.name}</div>
              {inFolder.map((p) => (
                <ProjectLink key={p.id} id={p.id} name={p.name} color={p.color} />
              ))}
            </div>
          );
        })}

        <div className="mt-1">
          {unfiled.map((p) => (
            <ProjectLink key={p.id} id={p.id} name={p.name} color={p.color} />
          ))}
        </div>

        {projects && projects.length === 0 && (
          <p className="px-2 py-2 text-sm text-muted">No projects yet.</p>
        )}
      </nav>

      <div className="border-t border-border p-3">
        <div className="mb-2 truncate text-sm">{me?.name ?? '…'}</div>
        <button onClick={onLogout} className="text-sm text-muted hover:text-foreground">
          Sign out
        </button>
      </div>

      {showCreate && currentWorkspaceId && (
        <CreateProjectModal
          workspaceId={currentWorkspaceId}
          folders={folders ?? []}
          onClose={() => setShowCreate(false)}
        />
      )}
    </aside>
  );
}

function ProjectLink({ id, name, color }: { id: string; name: string; color: keyof typeof COLOR_HEX }) {
  return (
    <NavLink
      to={`/app/projects/${id}`}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded-control px-2 py-1.5 text-sm ${
          isActive ? 'bg-background font-medium' : 'text-foreground'
        }`
      }
    >
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: COLOR_HEX[color] }}
      />
      <span className="truncate">{name}</span>
    </NavLink>
  );
}
