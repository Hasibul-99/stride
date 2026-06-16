import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEventInput, ProjectColor, RsvpStatus, UpdateEventInput } from '@teamboard/shared';
import { api } from '@/lib/api';

export interface EventParticipant {
  id: string;
  userId: string | null;
  email: string | null;
  responseStatus: RsvpStatus;
  user: { id: string; name: string; avatarUrl: string | null } | null;
}

export interface CalEvent {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string | null;
  color: ProjectColor;
  reminderMinutesBefore: number | null;
  recurrenceId: string | null;
  googleEventId: string | null;
  participants: EventParticipant[];
}

export function useEvents(from: string, to: string, projectId?: string) {
  return useQuery({
    queryKey: ['events', from, to, projectId ?? null],
    queryFn: async () =>
      (await api.get<CalEvent[]>('/events', { params: { from, to, projectId } })).data,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['events'] });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateEventInput) => (await api.post<CalEvent>('/events', input)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateEventInput & { id: string }) =>
      (await api.patch<CalEvent>(`/events/${id}`, input)).data,
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/events/${id}`);
    },
    onSuccess: () => invalidate(qc),
  });
}
