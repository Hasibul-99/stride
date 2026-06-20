import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { render, screen, waitFor } from '@/test/utils';
import { fakeSocket } from '@/test/fakeSocket';
import { makeUser } from '@/test/factories';
import { useAuthStore } from '@/store/auth.store';
import { ChatPanel } from './ChatPanel';

vi.mock('@/lib/socket', async () => {
  const { fakeSocket } = await import('@/test/fakeSocket');
  return { connectSocket: () => fakeSocket, getSocket: () => fakeSocket, disconnectSocket: () => {}, clientId: 'test-client' };
});

beforeEach(() => {
  fakeSocket.reset();
  useAuthStore.getState().setUser(makeUser({ id: 'u_me', name: 'Me' }));
});

function inboundMessage(over: Partial<{ id: string; authorId: string; body: string; name: string }> = {}) {
  return {
    id: over.id ?? 'm_in',
    taskId: 'task_1',
    authorId: over.authorId ?? 'u_other',
    body: over.body ?? 'hi there',
    editedAt: null,
    createdAt: new Date().toISOString(),
    author: { id: over.authorId ?? 'u_other', name: over.name ?? 'Other', avatarUrl: null },
  };
}

describe('ChatPanel', () => {
  it('renders a sent message optimistically and emits chat:send', async () => {
    const { user } = render(<ChatPanel taskId="task_1" />);

    await user.type(screen.getByPlaceholderText('Message…'), 'hello team');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('hello team')).toBeInTheDocument();
    const sends = fakeSocket.emitsFor(SOCKET_EVENTS.chatSend);
    expect(sends).toHaveLength(1);
    expect((sends[0].payload as { body: string }).body).toBe('hello team');
  });

  it('appends an inbound message event', async () => {
    render(<ChatPanel taskId="task_1" />);
    // wait for history to settle (empty)
    await waitFor(() => expect(screen.getByText('No messages yet.')).toBeInTheDocument());

    fakeSocket.server(SOCKET_EVENTS.chatNew, inboundMessage({ body: 'pushed in' }));

    expect(await screen.findByText('pushed in')).toBeInTheDocument();
  });

  it('reconciles the optimistic message when its server echo arrives (no duplicate)', async () => {
    const { user } = render(<ChatPanel taskId="task_1" />);
    await user.type(screen.getByPlaceholderText('Message…'), 'dedupe me');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText('dedupe me');

    // Server echoes the same message with a real id + our author id.
    fakeSocket.server(SOCKET_EVENTS.chatNew, inboundMessage({ id: 'real_1', authorId: 'u_me', body: 'dedupe me' }));

    await waitFor(() => expect(screen.getAllByText('dedupe me')).toHaveLength(1));
  });
});
