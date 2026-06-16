import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useGcalStatus() {
  return useQuery({
    queryKey: ['gcal-status'],
    queryFn: async () =>
      (await api.get<{ connected: boolean; configured: boolean }>('/integrations/google/status'))
        .data,
  });
}

export function useGcalConnect() {
  return useMutation({
    mutationFn: async () => (await api.get<{ url: string }>('/integrations/google/connect')).data,
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });
}

export function useGcalSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/integrations/google/sync')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

export function useGcalDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete('/integrations/google');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gcal-status'] }),
  });
}
