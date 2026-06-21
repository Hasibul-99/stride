import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { Toaster } from '@/components/ui/Toaster';
import { useToastStore } from '@/store/toast.store';
import { makeStatus, makeTask } from '@/test/factories';
import { installDndRects, keyboardDrag, draggable } from '@/test/dnd';
import { KanbanView } from './KanbanView';

const statuses = [
  makeStatus({ id: 's_new', name: 'New', position: 1000 }),
  makeStatus({ id: 's_done', name: 'Completed', color: 'green', position: 2000, isCompleted: true }),
];
const tasks = [
  makeTask({ id: 't1', title: 'First', statusId: 's_new', position: 1000 }),
  makeTask({ id: 't2', title: 'Second', statusId: 's_new', position: 2000 }),
];

// Two cards stacked in the New column so ArrowDown reorders within it.
const layout = {
  s_new: { x: 0, y: 0, width: 288, height: 600 },
  s_done: { x: 320, y: 0, width: 288, height: 600 },
  t1: { x: 10, y: 60, width: 260, height: 60 },
  t2: { x: 10, y: 140, width: 260, height: 60 },
};

let bulkBodies: { updates: { id: string; statusId?: string; position: number }[] }[] = [];
let uninstall: (() => void) | undefined;

beforeEach(() => {
  bulkBodies = [];
  queryClient.clear();
  useToastStore.setState({ toasts: [] });
  uninstall = installDndRects(layout);
  server.use(
    http.get('*/api/projects/:id/statuses', () => HttpResponse.json(statuses)),
    http.get('*/api/projects/:id/tasks', () => HttpResponse.json(tasks)),
  );
});
afterEach(() => uninstall?.());

describe('Kanban keyboard drag → bulk-positions request', () => {
  it('reordering within a column PATCHes the new position, same statusId', async () => {
    server.use(
      http.patch('*/api/projects/:id/tasks/positions', async ({ request }) => {
        bulkBodies.push((await request.json()) as (typeof bulkBodies)[number]);
        return HttpResponse.json({ updated: 1 });
      }),
    );
    const { user, container } = render(<KanbanView projectId="proj_1" projectColor="blue" />, {
      queryClient,
    });
    await screen.findByText('First');

    await keyboardDrag(user, draggable(container, 't1'), ['{ArrowDown}']);

    await waitFor(() => expect(bulkBodies).toHaveLength(1));
    const update = bulkBodies[0].updates[0];
    expect(update.id).toBe('t1');
    expect(update.statusId).toBe('s_new'); // stayed in the same column
    expect(typeof update.position).toBe('number');
  });

  it('snaps back and shows a toast when the move PATCH fails', async () => {
    server.use(
      http.patch('*/api/projects/:id/tasks/positions', async ({ request }) => {
        bulkBodies.push((await request.json()) as (typeof bulkBodies)[number]);
        return HttpResponse.json({ message: 'Move failed' }, { status: 500 });
      }),
    );
    const { user, container } = render(
      <>
        <KanbanView projectId="proj_1" projectColor="blue" />
        <Toaster />
      </>,
      { queryClient },
    );
    await screen.findByText('First');

    await keyboardDrag(user, draggable(container, 't1'), ['{ArrowDown}']);

    await waitFor(() => expect(bulkBodies).toHaveLength(1));
    expect(await screen.findByText('Move failed')).toBeInTheDocument();
    // Cache was never optimistically mutated, so both cards remain rendered.
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});
