import { z } from 'zod';
import { PROJECT_COLORS, RECURRENCE_FREQUENCIES, RSVP_STATUSES } from '../constants.js';

export const recurrenceSchema = z.object({
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.number().int().min(1).default(1),
  byWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  until: z.string().datetime().nullable().optional(),
  count: z.number().int().min(1).nullable().optional(),
});
export type RecurrenceInput = z.infer<typeof recurrenceSchema>;

export const participantSchema = z
  .object({
    userId: z.string().optional(),
    email: z.string().email().optional(),
  })
  .refine((p) => p.userId || p.email, { message: 'participant needs userId or email' });
export type ParticipantInput = z.infer<typeof participantSchema>;

export const createEventSchema = z.object({
  projectId: z.string().nullable().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).nullable().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().default(false),
  location: z.string().max(300).nullable().optional(),
  color: z.enum(PROJECT_COLORS).default('blue'),
  reminderMinutesBefore: z.number().int().min(0).nullable().optional(),
  participants: z.array(participantSchema).default([]),
  recurrence: recurrenceSchema.nullable().optional(),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.partial().omit({ recurrence: true });
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const rsvpSchema = z.object({
  token: z.string().min(1),
  response: z.enum(RSVP_STATUSES),
});
export type RsvpInput = z.infer<typeof rsvpSchema>;

export const eventQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  projectId: z.string().optional(),
});
export type EventQuery = z.infer<typeof eventQuerySchema>;
