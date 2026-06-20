import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { render, screen, within, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { fakeSocket } from '@/test/fakeSocket';
import { makeStatus, makeTask } from '@/test/factories';
import { KanbanView } from '@/features/kanban/KanbanView';
import { useProjectLive } from './useProjectLive';

vi.mock('@/lib/socket', async () => {
  const { fakeSocket } = await import('@/test/fakeSocket');
  return { connectSocket: () => fakeSocket, getSocket: () => fakeSocket, disconnectSocket: () => {}, clientId: 'test-client' };
});

const statuses = [
  makeStatus({ id: 's_new', name: 'New', position: 1000 }),
  makeStatus({ id: 's_done', name: 'Completed', color: 'green', position: 2000, isCompleted: true }),
];

beforeEach(() => {
  fakeSocket.reset();
  server.use(
    http.get('*/api/projects/:id/statuses', () => HttpResponse.json(statuses)),
    http.get('*/api/projects/:id/tasks', () =>
      HttpResponse.json([makeTask({ id: 'mover', title: 'Mover', statusId: 's_new', position: 1000 })]),
    ),
  );
});

function Harness() {
  useProjectLive('proj_1');
  return <KanbanView projectId="proj_1" projectColor="blue" />;
}

const newHeader = () => screen.getByText('New').parentElement!;
const doneHeader = () =>
  screen.getAllByText('Completed').find((el) => el.className.includes('font-medium'))!.parentElement!;

describe('useProjectLive — realtime cache patching', () => {
  it('moves the card to the new column on an inbound task:moved event', async () => {
    render(<Harness />);
    await screen.findByText('Mover');
    expect(within(newHeader()).getByText('1')).toBeInTheDocument();

    fakeSocket.server(SOCKET_EVENTS.taskMoved, {
      projectId: 'proj_1',
      originId: 'someone-else',
      task: { id: 'mover', statusId: 's_done' },
    });

    await waitFor(() => expect(within(doneHeader()).getByText('1')).toBeInTheDocument());
    expect(within(newHeader()).getByText('0')).toBeInTheDocument();
  });

  it('ignores a self-originated event (no double-apply)', async () => {
    render(<Harness />);
    await screen.findByText('Mover');

    fakeSocket.server(SOCKET_EVENTS.taskMoved, {
      projectId: 'proj_1',
      originId: 'test-client', // our own clientId → must be ignored
      task: { id: 'mover', statusId: 's_done' },
    });

    // Give any (unwanted) update a chance to flush, then assert nothing moved.
    await new Promise((r) => setTimeout(r, 20));
    expect(within(newHeader()).getByText('1')).toBeInTheDocument();
    expect(within(doneHeader()).getByText('0')).toBeInTheDocument();
  });
});
