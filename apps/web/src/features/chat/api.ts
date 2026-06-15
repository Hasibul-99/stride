import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ChatMessage {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  editedAt: string | null;
  createdAt: string;
  author: { id: string; name: string; avatarUrl: string | null };
}

export function useChatHistory(taskId: string | undefined) {
  return useQuery({
    queryKey: ['chat', taskId],
    enabled: !!taskId,
    queryFn: async () =>
      (await api.get<{ messages: ChatMessage[]; nextCursor: string | null }>(`/tasks/${taskId}/chat`))
        .data,
  });
}

export function useTaskUnread(taskId: string | undefined) {
  return useQuery({
    queryKey: ['chat-unread', taskId],
    enabled: !!taskId,
    queryFn: async () => (await api.get<{ count: number }>(`/tasks/${taskId}/chat/unread`)).data.count,
  });
}

export function useMarkChatRead() {
  const qc = useQueryClient();
  return async (taskId: string) => {
    await api.post(`/tasks/${taskId}/chat/read`);
    qc.invalidateQueries({ queryKey: ['chat-unread', taskId] });
  };
}
