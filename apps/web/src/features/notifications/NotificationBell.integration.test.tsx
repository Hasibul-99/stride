import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { render, screen } from '@/test/utils';
import { server } from '@/test/mocks/server';
import { NotificationBell } from './NotificationBell';

vi.mock('@/lib/socket', async () => {
  const { fakeSocket } = await import('@/test/fakeSocket');
  return { connectSocket: () => fakeSocket, getSocket: () => fakeSocket, disconnectSocket: () => {}, clientId: 'test-client' };
});

let readCalls: string[] = [];
beforeEach(() => {
  readCalls = [];
  server.use(
    http.get('*/api/notifications/unread-count', () => HttpResponse.json({ count: 3 })),
    http.get('*/api/notifications', () =>
      HttpResponse.json({
        items: [
          {
            id: 'n1',
            type: 'TASK_ASSIGNED',
            payload: { title: 'Wireframe', projectId: 'proj_9' },
            readAt: null,
            createdAt: new Date().toISOString(),
          },
        ],
        nextCursor: null,
      }),
    ),
    http.post('*/api/notifications/:id/read', ({ params }) => {
      readCalls.push(String(params.id));
      return HttpResponse.json({ ok: true });
    }),
  );
});

function Harness() {
  return (
    <>
      <NotificationBell />
      <Routes>
        <Route path="/" element={<div>Home</div>} />
        <Route path="/app/projects/:id" element={<div>Project Page</div>} />
      </Routes>
    </>
  );
}

describe('NotificationBell', () => {
  it('shows the unread count', async () => {
    render(<Harness />);
    expect(await screen.findByText('3')).toBeInTheDocument();
  });

  it('opens the panel, marks an item read, and navigates to its project', async () => {
    const { user } = render(<Harness />);
    await screen.findByText('3');

    await user.click(screen.getByRole('button', { name: /🔔/ }));
    expect(await screen.findByText(/assigned you a task/i)).toBeInTheDocument();

    await user.click(screen.getByText(/assigned you a task/i));

    expect(readCalls).toContain('n1');
    expect(await screen.findByText('Project Page')).toBeInTheDocument();
  });
});
