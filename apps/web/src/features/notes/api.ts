import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateNoteInput, UpdateNoteInput } from '@teamboard/shared';
import { api } from '@/lib/api';

export interface Note {
  id: string;
  projectId: string;
  title: string;
  content: unknown;
  position: number;
  updatedAt: string;
  createdBy?: { id: string; name: string };
}

export function useNotes(projectId: string | undefined) {
  return useQuery({
    queryKey: ['notes', projectId],
    enabled: !!projectId,
    queryFn: async () => (await api.get<Note[]>(`/projects/${projectId}/notes`)).data,
  });
}

export function useCreateNote(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateNoteInput) =>
      (await api.post<Note>(`/projects/${projectId}/notes`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', projectId] }),
  });
}

export function useUpdateNote(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateNoteInput & { id: string }) =>
      (await api.patch<Note>(`/notes/${id}`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', projectId] }),
  });
}

export function useDeleteNote(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notes/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes', projectId] }),
  });
}
