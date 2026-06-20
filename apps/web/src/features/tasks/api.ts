import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BulkPositionsInput,
  CreateStatusInput,
  CreateTaskInput,
  ProjectColor,
  UpdateStatusInput,
  UpdateTaskInput,
} from '@teamboard/shared';
import { api } from '@/lib/api';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: unknown;
  statusId: string;
  assigneeId: string | null;
  scheduledDate: string | null;
  position: number;
  timeEstimateMinutes: number | null;
  completedAt: string | null;
  recurrenceId: string | null;
}

export interface TaskStatus {
  id: string;
  projectId: string;
  name: string;
  color: ProjectColor;
  position: number;
  isDefault: boolean;
  isCompleted: boolean;
}

export interface ProjectMember {
  id: string;
  role: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

const tasksKey = (projectId: string) => ['tasks', projectId];
const statusesKey = (projectId: string) => ['statuses', projectId];

export function useTasks(projectId: string | undefined, includeCompleted = true) {
  return useQuery({
    queryKey: [...tasksKey(projectId ?? ''), { includeCompleted }],
    enabled: !!projectId,
    queryFn: async () =>
      (
        await api.get<Task[]>(`/projects/${projectId}/tasks`, {
          params: { includeCompleted },
        })
      ).data,
  });
}

export function useStatuses(projectId: string | undefined) {
  return useQuery({
    queryKey: statusesKey(projectId ?? ''),
    enabled: !!projectId,
    queryFn: async () => (await api.get<TaskStatus[]>(`/projects/${projectId}/statuses`)).data,
  });
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-members', projectId],
    enabled: !!projectId,
    queryFn: async () => (await api.get<ProjectMember[]>(`/projects/${projectId}/members`)).data,
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) =>
      (await api.post<Task>(`/projects/${projectId}/tasks`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(projectId) }),
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateTaskInput & { id: string }) =>
      (await api.patch<Task>(`/tasks/${id}`, input)).data,
    // Optimistically patch every cached task list for this project; roll back on error.
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: tasksKey(projectId) });
      const snapshot = qc.getQueriesData<Task[]>({ queryKey: tasksKey(projectId) });
      qc.setQueriesData<Task[]>({ queryKey: tasksKey(projectId) }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...(patch as Partial<Task>) } : t)),
      );
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshot?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: tasksKey(projectId) }),
  });
}

export function useDeleteTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (arg: string | { id: string; scope: 'THIS' | 'THIS_AND_FOLLOWING' | 'ALL' }) => {
      const id = typeof arg === 'string' ? arg : arg.id;
      const scope = typeof arg === 'string' ? undefined : arg.scope;
      await api.delete(`/tasks/${id}`, { params: scope ? { scope } : undefined });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(projectId) }),
  });
}

export function useBulkPositions(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: BulkPositionsInput) => {
      await api.patch(`/projects/${projectId}/tasks/positions`, input);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tasksKey(projectId) }),
  });
}

export function useCreateStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateStatusInput) =>
      (await api.post<TaskStatus>(`/projects/${projectId}/statuses`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: statusesKey(projectId) }),
  });
}

export function useUpdateStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateStatusInput & { id: string }) =>
      (await api.patch<TaskStatus>(`/statuses/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: statusesKey(projectId) }),
  });
}

export function useDeleteStatus(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, targetStatusId }: { id: string; targetStatusId: string }) => {
      await api.delete(`/statuses/${id}`, { params: { targetStatusId } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: statusesKey(projectId) });
      qc.invalidateQueries({ queryKey: tasksKey(projectId) });
    },
  });
}
