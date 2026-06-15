import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ManualTimeEntryInput } from '@teamboard/shared';
import { api } from '@/lib/api';

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  stoppedAt: string | null;
  durationSeconds: number | null;
  user?: { id: string; name: string; avatarUrl: string | null };
}

export interface RunningTimer extends TimeEntry {
  task: { id: string; title: string; projectId: string };
}

export function useRunningTimer() {
  return useQuery({
    queryKey: ['time-running'],
    queryFn: async () => (await api.get<RunningTimer | null>('/time/running')).data,
    refetchInterval: 30_000,
  });
}

export function useTaskTime(taskId: string | undefined) {
  return useQuery({
    queryKey: ['time-task', taskId],
    enabled: !!taskId,
    queryFn: async () =>
      (await api.get<{ entries: TimeEntry[]; totalSeconds: number }>(`/tasks/${taskId}/time`)).data,
  });
}

function invalidateTime(qc: ReturnType<typeof useQueryClient>, taskId?: string) {
  qc.invalidateQueries({ queryKey: ['time-running'] });
  if (taskId) qc.invalidateQueries({ queryKey: ['time-task', taskId] });
}

export function useStartTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => (await api.post(`/tasks/${taskId}/time/start`)).data,
    onSuccess: (_d, taskId) => invalidateTime(qc, taskId),
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => (await api.post(`/tasks/${taskId}/time/stop`)).data,
    onSuccess: (_d, taskId) => invalidateTime(qc, taskId),
  });
}

export function useAddManualTime(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ManualTimeEntryInput) =>
      (await api.post(`/tasks/${taskId}/time`, input)).data,
    onSuccess: () => invalidateTime(qc, taskId),
  });
}

export function useDeleteTimeEntry(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      await api.delete(`/time/${entryId}`);
    },
    onSuccess: () => invalidateTime(qc, taskId),
  });
}

/** Live elapsed seconds since an ISO start, ticking each second. */
export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
