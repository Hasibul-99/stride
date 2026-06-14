import { useParams } from 'react-router-dom';
import { useProject } from '@/features/workspaces/api';
import { COLOR_HEX } from '@/features/workspaces/colors';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError } = useProject(id);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (isError || !project) return <p className="text-muted">Project not found or no access.</p>;

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: COLOR_HEX[project.color] }}
        />
        <h1 className="text-2xl font-semibold">{project.name}</h1>
      </div>
      {project.description && <p className="mb-6 text-muted">{project.description}</p>}
      <div className="rounded-card border border-border bg-surface p-6 text-muted">
        Calendar, Kanban and Table views land in Phase 4.
      </div>
    </div>
  );
}
