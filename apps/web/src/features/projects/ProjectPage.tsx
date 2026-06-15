import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useProject } from '@/features/workspaces/api';
import { COLOR_HEX } from '@/features/workspaces/colors';
import { Tabs } from '@/components/ui/Tabs';
import { CalendarView } from '@/features/calendar/CalendarView';
import { KanbanView } from '@/features/kanban/KanbanView';
import { TableView } from '@/features/table/TableView';
import { useProjectLive } from '@/features/realtime/useProjectLive';

type View = 'calendar' | 'kanban' | 'table';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, isLoading, isError } = useProject(id);
  const [view, setView] = useState<View>('calendar');
  useProjectLive(id);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (isError || !project || !id) return <p className="text-muted">Project not found or no access.</p>;

  return (
    <div className="flex h-full flex-col">
      <header className="mb-4 flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ background: COLOR_HEX[project.color] }} />
        <h1 className="text-2xl font-semibold">{project.name}</h1>
        <div className="ml-auto">
          <Tabs
            tabs={[
              { id: 'calendar', label: 'Calendar' },
              { id: 'kanban', label: 'Kanban' },
              { id: 'table', label: 'Table' },
            ]}
            active={view}
            onChange={setView}
          />
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {view === 'calendar' && <CalendarView projectId={id} projectColor={project.color} />}
        {view === 'kanban' && <KanbanView projectId={id} projectColor={project.color} />}
        {view === 'table' && <TableView projectId={id} />}
      </div>
    </div>
  );
}
