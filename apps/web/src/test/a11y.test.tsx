import { describe, it, expect, vi, beforeEach } from 'vitest';
import { axe } from 'vitest-axe';
import { render, screen, waitFor } from './utils';
import { makeTask } from './factories';
import { DesignSystemPage } from '@/features/design/DesignSystemPage';
import { TaskDrawer } from '@/features/tasks/TaskDrawer';
import { CreateProjectModal } from '@/features/workspaces/CreateProjectModal';
import { EventModal } from '@/features/events/EventModal';
import { StatusManager } from '@/features/tasks/StatusManager';
import { KanbanView } from '@/features/kanban/KanbanView';
import { CalendarView } from '@/features/calendar/CalendarView';

vi.mock('@/lib/socket', async () => {
  const { fakeSocket } = await import('./fakeSocket');
  return { connectSocket: () => fakeSocket, getSocket: () => fakeSocket, disconnectSocket: () => {}, clientId: 'test-client' };
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
});

const noViolations = async (container: HTMLElement) => expect(await axe(container)).toHaveNoViolations();

describe('accessibility (default states)', () => {
  it('design-system primitives', async () => {
    const { container } = render(<DesignSystemPage />);
    await screen.findByText('Buttons');
    await noViolations(container);
  });

  it('task drawer', async () => {
    const { container } = render(
      <TaskDrawer projectId="proj_0001" task={makeTask({ title: 'A11y task' })} onClose={() => {}} />,
    );
    await screen.findByRole('dialog');
    await noViolations(container);
  });

  it('create-project modal', async () => {
    const { container } = render(
      <CreateProjectModal workspaceId="ws_0001" folders={[]} onClose={() => {}} />,
    );
    await screen.findByRole('dialog');
    await noViolations(container);
  });

  it('event modal', async () => {
    const { container } = render(<EventModal projectId="proj_0001" onClose={() => {}} />);
    await screen.findByRole('dialog');
    await noViolations(container);
  });

  it('status manager', async () => {
    const { container } = render(<StatusManager projectId="proj_0001" onClose={() => {}} />);
    await screen.findByRole('dialog');
    await noViolations(container);
  });

  it('kanban view', async () => {
    const { container } = render(<KanbanView projectId="proj_0001" projectColor="blue" />);
    await waitFor(() => expect(screen.getAllByText('New').length).toBeGreaterThan(0));
    await noViolations(container);
  });

  it('calendar view', async () => {
    const { container } = render(<CalendarView projectId="proj_0001" projectColor="blue" />);
    await screen.findByText('Waiting list');
    await noViolations(container);
  });
});
