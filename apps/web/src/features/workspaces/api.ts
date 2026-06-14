import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateProjectInput,
  CreateWorkspaceInput,
  ProjectColor,
  UpdateProjectInput,
  WorkspaceRole,
} from '@teamboard/shared';
import { api } from '@/lib/api';

export interface Workspace {
  id: string;
  name: string;
  logoUrl: string | null;
  role: WorkspaceRole;
}

export interface Folder {
  id: string;
  workspaceId: string;
  name: string;
  position: number;
}

export interface Project {
  id: string;
  workspaceId: string;
  folderId: string | null;
  name: string;
  color: ProjectColor;
  description: string | null;
  position: number;
  archivedAt: string | null;
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: async () => (await api.get<Workspace[]>('/workspaces')).data,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWorkspaceInput) =>
      (await api.post<Workspace>('/workspaces', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workspaces'] }),
  });
}

export function useFolders(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['folders', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => (await api.get<Folder[]>(`/workspaces/${workspaceId}/folders`)).data,
  });
}

export function useProjects(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ['projects', workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => (await api.get<Project[]>(`/workspaces/${workspaceId}/projects`)).data,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    enabled: !!projectId,
    queryFn: async () => (await api.get<Project>(`/projects/${projectId}`)).data,
  });
}

export function useCreateProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProjectInput) =>
      (await api.post<Project>(`/workspaces/${workspaceId}/projects`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  });
}

export function useUpdateProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateProjectInput & { id: string }) =>
      (await api.patch<Project>(`/projects/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  });
}

export function useDeleteProject(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', workspaceId] }),
  });
}
