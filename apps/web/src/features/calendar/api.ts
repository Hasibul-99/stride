import { useQuery } from '@tanstack/react-query';
import type { ProjectColor } from '@teamboard/shared';
import { api } from '@/lib/api';

export interface PlannerTask {
  id: string;
  projectId: string;
  title: string;
  statusId: string;
  assigneeId: string | null;
  scheduledDate: string | null;
  position: number;
  timeEstimateMinutes: number | null;
  completedAt: string | null;
  project: { id: string; name: string; color: ProjectColor };
  status: { id: string; name: string; color: ProjectColor; isCompleted: boolean };
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface PlannerMember {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function usePlanner(
  workspaceId: string | undefined,
  from: string,
  to: string,
  assigneeId?: string,
) {
  return useQuery({
    queryKey: ['planner', workspaceId, from, to, assigneeId ?? null],
    enabled: !!workspaceId,
    queryFn: async () =>
      (
        await api.get<PlannerTask[]>(`/workspaces/${workspaceId}/planner`, {
          params: { from, to, assigneeId },
        })
      ).data,
  });
}

export function usePlannerMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['planner-members', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () =>
      (await api.get<PlannerMember[]>(`/workspaces/${workspaceId}/planner-members`)).data,
  });
}
