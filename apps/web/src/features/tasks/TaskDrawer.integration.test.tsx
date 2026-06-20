import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { fakeSocket } from '@/test/fakeSocket';
import { makeTask } from '@/test/factories';
import { TaskDrawer } from './TaskDrawer';

vi.mock('@/lib/socket', async () => {
  const { fakeSocket } = await import('@/test/fakeSocket');
  return {
    connectSocket: () => fakeSocket,
    getSocket: () => fakeSocket,
    disconnectSocket: () => {},
    clientId: 'test-client',
  };
});

// Capture every PATCH /tasks/:id body the drawer sends.
let patches: Record<string, unknown>[] = [];
beforeEach(() => {
  patches = [];
  fakeSocket.reset();
  server.use(
    http.patch('*/api/tasks/:id', async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      patches.push(body);
      return HttpResponse.json({ id: params.id, ...body });
    }),
  );
});

const task = makeTask({ id: 'task_1', title: 'Original title', statusId: 'status_new' });

function lastPatch() {
  return patches[patches.length - 1];
}

describe('TaskDrawer — edit payloads', () => {
  it('edits the title → PATCH { title }', async () => {
    const { user } = render(<TaskDrawer projectId="proj_1" task={task} onClose={() => {}} />);
    const title = await screen.findByLabelText('Task title');
    await user.clear(title);
    await user.type(title, 'Renamed task');
    await user.tab();
    await waitFor(() => expect(lastPatch()).toEqual({ title: 'Renamed task' }));
  });

  it('changes the status → PATCH { statusId }', async () => {
    const { user } = render(<TaskDrawer projectId="proj_1" task={task} onClose={() => {}} />);
    await screen.findByRole('option', { name: 'Completed ✓' }); // options loaded
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'status_done');
    await waitFor(() => expect(lastPatch()).toEqual({ statusId: 'status_done' }));
  });

  it('changes the assignee → PATCH { assigneeId }', async () => {
    const { user } = render(<TaskDrawer projectId="proj_1" task={task} onClose={() => {}} />);
    await screen.findByRole('option', { name: 'Bob Martins' }); // members loaded
    await user.selectOptions(screen.getByRole('combobox', { name: 'Assignee' }), 'u_bob');
    await waitFor(() => expect(lastPatch()).toEqual({ assigneeId: 'u_bob' }));
  });

  it('sets the time estimate → PATCH { timeEstimateMinutes: 90 }', async () => {
    const { user } = render(<TaskDrawer projectId="proj_1" task={task} onClose={() => {}} />);
    const est = await screen.findByLabelText('Time estimate');
    await user.type(est, '1h 30m');
    await user.tab();
    await waitFor(() => expect(lastPatch()).toEqual({ timeEstimateMinutes: 90 }));
  });
});
