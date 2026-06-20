import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { SOCKET_EVENTS } from '@teamboard/shared';
import { connectSocket } from '@/lib/socket';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/auth.store';
import { useChatHistory, useMarkChatRead, type ChatMessage } from './api';

export function ChatPanel({ taskId }: { taskId: string }) {
  const { data } = useChatHistory(taskId);
  const markRead = useMarkChatRead();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  // Merge REST history in without clobbering live socket/optimistic messages.
  useEffect(() => {
    if (!data?.messages) return;
    setMessages((prev) => {
      const byId = new Map(data.messages.map((m) => [m.id, m]));
      for (const m of prev) if (!byId.has(m.id)) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
  }, [data]);

  useEffect(() => {
    const socket = connectSocket();
    const join = () => socket.emit(SOCKET_EVENTS.joinTask, { taskId });
    if (socket.connected) join();
    socket.on('connect', join);

    const onNew = (m: ChatMessage) => {
      if (m.taskId !== taskId) return;
      setMessages((prev) => {
        // Drop the optimistic placeholder this echo replaces.
        const withoutTemp = prev.filter(
          (x) => !(x.id.startsWith('temp-') && x.body === m.body && x.authorId === m.authorId),
        );
        return withoutTemp.some((x) => x.id === m.id) ? withoutTemp : [...withoutTemp, m];
      });
    };
    const onUpdated = (m: ChatMessage) =>
      setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
    const onDeleted = (p: { id: string }) =>
      setMessages((prev) => prev.filter((x) => x.id !== p.id));
    const onTyping = (p: { taskId: string; userId: string }) => {
      if (p.taskId !== taskId) return;
      setTypingUsers((prev) => new Set(prev).add(p.userId));
      setTimeout(() => setTypingUsers((prev) => {
        const n = new Set(prev);
        n.delete(p.userId);
        return n;
      }), 2500);
    };

    socket.on(SOCKET_EVENTS.chatNew, onNew);
    socket.on(SOCKET_EVENTS.chatUpdated, onUpdated);
    socket.on(SOCKET_EVENTS.chatDeleted, onDeleted);
    socket.on(SOCKET_EVENTS.typingPing, onTyping);
    void markRead(taskId);

    return () => {
      socket.emit(SOCKET_EVENTS.leaveTask, { taskId });
      socket.off('connect', join);
      socket.off(SOCKET_EVENTS.chatNew, onNew);
      socket.off(SOCKET_EVENTS.chatUpdated, onUpdated);
      socket.off(SOCKET_EVENTS.chatDeleted, onDeleted);
      socket.off(SOCKET_EVENTS.typingPing, onTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (messages.length) void markRead(taskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  function send() {
    const body = draft.trim();
    if (!body) return;
    const me = useAuthStore.getState().user;
    // Optimistic placeholder; reconciled when the server's chat:new echoes back.
    const temp: ChatMessage = {
      id: `temp-${Date.now()}`,
      taskId,
      authorId: me?.id ?? 'me',
      body,
      editedAt: null,
      createdAt: new Date().toISOString(),
      author: { id: me?.id ?? 'me', name: me?.name ?? 'You', avatarUrl: me?.avatarUrl ?? null },
    };
    setMessages((prev) => [...prev, temp]);
    connectSocket().emit(SOCKET_EVENTS.chatSend, { taskId, body, mentions: [] });
    setDraft('');
  }

  return (
    <div className="flex flex-col border-t border-border pt-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Chat</div>

      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id} className="flex gap-2">
            <Avatar name={m.author.name} avatarUrl={m.author.avatarUrl} />
            <div className="min-w-0">
              <div className="text-xs text-muted">
                {m.author.name} · {format(new Date(m.createdAt), 'HH:mm')}
                {m.editedAt ? ' (edited)' : ''}
              </div>
              <div className="whitespace-pre-wrap break-words text-sm">{m.body}</div>
            </div>
          </div>
        ))}
        {messages.length === 0 && <p className="text-sm text-muted">No messages yet.</p>}
        <div ref={bottomRef} />
      </div>

      {typingUsers.size > 0 && (
        <div className="mt-1 text-xs italic text-muted">someone is typing…</div>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            connectSocket().emit(SOCKET_EVENTS.chatTyping, { taskId });
          }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Message…"
          className="flex-1 rounded-control border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <button onClick={send} className="rounded-control bg-primary px-3 py-2 text-sm text-primary-foreground">
          Send
        </button>
      </div>
    </div>
  );
}
