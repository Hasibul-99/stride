import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { render, screen, within, waitFor } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { makeStatus, makeTask, makeUser } from '@/test/factories';
import { CalendarView } from './CalendarView';

const statuses = [makeStatus({ id: 's_new', name: 'New' })];
const members = [
  { id: 'pm1', role: 'MANAGER', user: makeUser({ id: 'u_alice', name: 'Alice Chen' }) },
  { id: 'pm2', role: 'MEMBER', user: makeUser({ id: 'u_bob', name: 'Bob Martins' }) },
];
const tasks = [
  makeTask({ id: 't1', title: 'Alpha', statusId: 's_new', scheduledDate: '2026-06-16', assigneeId: 'u_alice' }),
  makeTask({ id: 't2', title: 'Backlog item', statusId: 's_new', scheduledDate: null, assigneeId: 'u_alice' }),
  makeTask({ id: 't3', title: 'Done thing', statusId: 's_new', scheduledDate: '2026-06-17', assigneeId: 'u_bob', completedAt: '2026-06-17T16:00:00Z' }),
];

beforeEach(() => {
  // Pin "today" to Mon 2026-06-15 but let timers advance so async queries resolve.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
  server.use(
    http.get('*/api/projects/:id/statuses', () => HttpResponse.json(statuses)),
    http.get('*/api/projects/:id/members', () => HttpResponse.json(members)),
    http.get('*/api/projects/:id/tasks', () => HttpResponse.json(tasks)),
    http.get('*/api/events', () => HttpResponse.json([])),
  );
});
afterEach(() => vi.useRealTimers());

function waitingPanel() {
  return screen.getByText('Waiting list').closest('[class*="rounded-card"]') as HTMLElement;
}

describe('CalendarView', () => {
  it('puts scheduled tasks on the board and null-date tasks in the waiting list', async () => {
    render(<CalendarView projectId="proj_1" projectColor="violet" />);

    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    // Backlog item is in the waiting-list panel; the scheduled task is not.
    expect(within(waitingPanel()).getByText('Backlog item')).toBeInTheDocument();
    expect(within(waitingPanel()).queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('hides completed tasks when the filter is toggled off', async () => {
    const { user } = render(<CalendarView projectId="proj_1" projectColor="violet" />);
    expect(await screen.findByText('Done thing')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /completed/i }));
    await waitFor(() => expect(screen.queryByText('Done thing')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('filters by assignee', async () => {
    const { user } = render(<CalendarView projectId="proj_1" projectColor="violet" />);
    expect(await screen.findByText('Alpha')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter by Alice Chen' }));

    // Only Alice's tasks remain; Bob's task is filtered out.
    await waitFor(() => expect(screen.queryByText('Done thing')).not.toBeInTheDocument());
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Backlog item')).toBeInTheDocument();
  });
});
