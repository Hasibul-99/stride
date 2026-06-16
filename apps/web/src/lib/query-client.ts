import { MutationCache, QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { toast } from '@/store/toast.store';

function messageOf(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { message?: string | string[] } | undefined;
    const msg = data?.message;
    if (Array.isArray(msg)) return msg[0];
    if (typeof msg === 'string') return msg;
    return error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}

export const queryClient = new QueryClient({
  // Surface mutation failures as toasts globally.
  mutationCache: new MutationCache({
    onError: (error) => {
      // 401 is handled by the auth refresh/redirect interceptor.
      if (isAxiosError(error) && error.response?.status === 401) return;
      toast(messageOf(error), 'error');
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
