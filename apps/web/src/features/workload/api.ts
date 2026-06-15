import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WorkloadCell {
  taskMinutes: number;
  eventMinutes: number;
  taskCount: number;
  unestimatedCount: number;
}

export interface WorkloadMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  capacityMinutes: number;
}

export interface WorkloadData {
  members: WorkloadMember[];
  cells: Record<string, Record<string, WorkloadCell>>;
}

export function useWorkload(workspaceId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ['workload', workspaceId, from, to],
    enabled: !!workspaceId,
    queryFn: async () =>
      (await api.get<WorkloadData>(`/workspaces/${workspaceId}/workload`, { params: { from, to } })).data,
  });
}

export function useSetCapacity(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; dailyMinutes: number }) =>
      (await api.patch(`/workspaces/${workspaceId}/capacity`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workload', workspaceId] }),
  });
}

export interface TimeReport {
  totalSeconds: number;
  byUser: { label: string; seconds: number }[];
  byProject: { label: string; seconds: number }[];
  entries: {
    id: string;
    startedAt: string;
    stoppedAt: string | null;
    durationSeconds: number | null;
    user: { id: string; name: string };
    task: { id: string; title: string; project: { id: string; name: string } };
  }[];
}

export function useTimeReport(
  workspaceId: string | undefined,
  params: { from?: string; to?: string; projectId?: string; userId?: string },
) {
  return useQuery({
    queryKey: ['time-report', workspaceId, params],
    enabled: !!workspaceId,
    queryFn: async () =>
      (await api.get<TimeReport>(`/workspaces/${workspaceId}/time-report`, { params })).data,
  });
}
