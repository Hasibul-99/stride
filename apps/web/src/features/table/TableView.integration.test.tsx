import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { makeStatus, makeTask } from '@/test/factories';
import { TableView } from './TableView';

const statuses = [
  makeStatus({ id: 's_new', name: 'New', position: 1000 }),
  makeStatus({ id: 's_done', name: 'Completed', color: 'green', position: 2000, isCompleted: true }),
];
const tasks = [
  makeTask({ id: 't_apple', title: 'Apple', statusId: 's_new', scheduledDate: '2026-06-03' }),
  makeTask({ id: 't_banana', title: 'Banana', statusId: 's_new', scheduledDate: '2026-06-01' }),
  makeTask({ id: 't_cherry', title: 'Cherry', statusId: 's_new', scheduledDate: '2026-06-02' }),
];

let patches: { id: string; body: Record<string, unknown> }[] = [];
beforeEach(() => {
  patches = [];
  server.use(
    http.get('*/api/projects/:id/statuses', () => HttpResponse.json(statuses)),
    http.get('*/api/projects/:id/tasks', () => HttpResponse.json(tasks)),
    http.patch('*/api/tasks/:id', async ({ request, params }) => {
      patches.push({ id: String(params.id), body: (await request.json()) as Record<string, unknown> });
      return HttpResponse.json({ id: params.id });
    }),
  );
});

const titleOrder = () =>
  screen.getAllByRole('textbox').map((i) => (i as HTMLInputElement).value);

describe('TableView', () => {
  it('inline-edits a status cell → PATCH { statusId }', async () => {
    const { user } = render(<TableView projectId="proj_1" />);
    const row = (await screen.findByDisplayValue('Banana')).closest('tr')!;
    const statusSelect = within(row).getAllByRole('combobox')[0]; // status, then assignee
    await user.selectOptions(statusSelect, 's_done');
    await waitFor(() => expect(patches).toContainEqual({ id: 't_banana', body: { statusId: 's_done' } }));
  });

  it('sorts rows when a column header is clicked', async () => {
    const { user } = render(<TableView projectId="proj_1" />);
    await screen.findByDisplayValue('Apple');
    // Default sort = date asc → Banana(01), Cherry(02), Apple(03).
    expect(titleOrder()).toEqual(['Banana', 'Cherry', 'Apple']);
    await user.click(screen.getByText('Title'));
    expect(titleOrder()).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('groups rows by status', async () => {
    const { user } = render(<TableView projectId="proj_1" />);
    await screen.findByDisplayValue('Apple');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Group by' }), 'status');
    expect(await screen.findByText('New · 3')).toBeInTheDocument();
  });

  it('bulk status change PATCHes each selected task', async () => {
    const { user } = render(<TableView projectId="proj_1" />);
    await screen.findByDisplayValue('Apple');

    // Row checkboxes (skip the toolbar "Completed" filter checkbox at index 0).
    const checkboxes = screen.getAllByRole('checkbox').slice(1);
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Bulk set status' }), 's_done');

    await waitFor(() => expect(patches).toHaveLength(2));
    expect(patches.every((p) => (p.body as { statusId: string }).statusId === 's_done')).toBe(true);
  });
});
