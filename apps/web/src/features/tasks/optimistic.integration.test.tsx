import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { queryClient } from '@/lib/query-client';
import { Toaster } from '@/components/ui/Toaster';
import { useToastStore } from '@/store/toast.store';
import { makeStatus, makeTask } from '@/test/factories';
import { TableView } from '@/features/table/TableView';

// Real app queryClient so the global MutationCache onError → toast fires.
const statuses = [
  makeStatus({ id: 's_new', name: 'New', position: 1000 }),
  makeStatus({ id: 's_done', name: 'Completed', color: 'green', position: 2000, isCompleted: true }),
];

beforeEach(() => {
  queryClient.clear();
  useToastStore.setState({ toasts: [] });
});

function renderTable() {
  return render(
    <>
      <TableView projectId="proj_1" />
      <Toaster />
    </>,
    { queryClient },
  );
}

function statusSelectFor(title: string) {
  const row = screen.getByDisplayValue(title).closest('tr')!;
  return within(row).getAllByRole('combobox')[0] as HTMLSelectElement;
}

describe('optimistic update + rollback', () => {
  it('reverts the change and shows a toast when the PATCH fails', async () => {
    server.use(
      http.get('*/api/projects/:id/statuses', () => HttpResponse.json(statuses)),
      http.get('*/api/projects/:id/tasks', () =>
        HttpResponse.json([makeTask({ id: 't1', title: 'Solo', statusId: 's_new' })]),
      ),
      http.patch('*/api/tasks/:id', () => HttpResponse.json({ message: 'Update failed' }, { status: 500 })),
    );

    const { user } = renderTable();
    await screen.findByDisplayValue('Solo');

    await user.selectOptions(statusSelectFor('Solo'), 's_done');

    // Rolls back to the original status…
    await waitFor(() => expect(statusSelectFor('Solo').value).toBe('s_new'));
    // …and surfaces the error as a toast.
    expect(await screen.findByText('Update failed')).toBeInTheDocument();
  });

  it('completing a task (move to a completed status) greys it', async () => {
    let completed = false;
    server.use(
      http.get('*/api/projects/:id/statuses', () => HttpResponse.json(statuses)),
      http.get('*/api/projects/:id/tasks', () =>
        HttpResponse.json([
          makeTask({
            id: 't1',
            title: 'Finish me',
            statusId: completed ? 's_done' : 's_new',
            completedAt: completed ? '2026-06-17T16:00:00Z' : null,
          }),
        ]),
      ),
      http.patch('*/api/tasks/:id', () => {
        completed = true; // server marks it completed
        return HttpResponse.json({ id: 't1', statusId: 's_done', completedAt: '2026-06-17T16:00:00Z' });
      }),
    );

    const { user } = renderTable();
    const title = await screen.findByDisplayValue('Finish me');

    await user.selectOptions(statusSelectFor('Finish me'), 's_done');

    // After settle + refetch, the row reflects the completed state (strikethrough).
    await waitFor(() =>
      expect((screen.getByDisplayValue('Finish me') as HTMLInputElement).className).toContain('line-through'),
    );
    expect(title.closest('tr')!.className).toContain('opacity-60');
  });
});
