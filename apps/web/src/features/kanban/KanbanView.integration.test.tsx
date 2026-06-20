import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { makeStatus, makeTask } from '@/test/factories';
import { KanbanView } from './KanbanView';

const statuses = [
  makeStatus({ id: 's_new', name: 'New', position: 1000, isDefault: true }),
  makeStatus({ id: 's_prog', name: 'In progress', color: 'blue', position: 2000 }),
  makeStatus({ id: 's_done', name: 'Completed', color: 'green', position: 3000, isCompleted: true }),
];

const tasks = [
  makeTask({ id: 't1', title: 'Audit', statusId: 's_new', timeEstimateMinutes: 60, position: 1000 }),
  makeTask({ id: 't2', title: 'Sitemap', statusId: 's_new', timeEstimateMinutes: 30, position: 2000 }),
  makeTask({ id: 't3', title: 'Wireframe', statusId: 's_prog', timeEstimateMinutes: 120, position: 1000 }),
];

beforeEach(() => {
  server.use(
    http.get('*/api/projects/:id/statuses', () => HttpResponse.json(statuses)),
    http.get('*/api/projects/:id/tasks', () => HttpResponse.json(tasks)),
  );
});

describe('KanbanView', () => {
  it('renders a column per status with the right tasks, counts and summed estimates', async () => {
    render(<KanbanView projectId="proj_1" projectColor="violet" />);

    // All tasks rendered.
    expect(await screen.findByText('Audit')).toBeInTheDocument();
    expect(screen.getByText('Wireframe')).toBeInTheDocument();

    // "New" column header: count 2, summed estimate 90m.
    const newHeader = screen.getByText('New').parentElement!;
    expect(within(newHeader).getByText('2')).toBeInTheDocument();
    expect(within(newHeader).getByText('1h 30m')).toBeInTheDocument();

    // "In progress" header: count 1, summed estimate 2h.
    const progHeader = screen.getByText('In progress').parentElement!;
    expect(within(progHeader).getByText('1')).toBeInTheDocument();
    expect(within(progHeader).getByText('2h')).toBeInTheDocument();

    // "Completed" header: count 0 (disambiguate from the "Completed" filter label).
    const doneTitle = screen
      .getAllByText('Completed')
      .find((el) => el.className.includes('font-medium'))!;
    expect(within(doneTitle.parentElement!).getByText('0')).toBeInTheDocument();
  });
});
