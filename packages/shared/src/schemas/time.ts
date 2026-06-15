import { z } from 'zod';

export const manualTimeEntrySchema = z
  .object({
    startedAt: z.string().datetime(),
    stoppedAt: z.string().datetime(),
  })
  .refine((v) => new Date(v.stoppedAt) > new Date(v.startedAt), {
    message: 'stoppedAt must be after startedAt',
  });
export type ManualTimeEntryInput = z.infer<typeof manualTimeEntrySchema>;

export const updateTimeEntrySchema = z.object({
  startedAt: z.string().datetime().optional(),
  stoppedAt: z.string().datetime().nullable().optional(),
});
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;

export const timeReportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  projectId: z.string().optional(),
  userId: z.string().optional(),
});
export type TimeReportQuery = z.infer<typeof timeReportQuerySchema>;

export const setCapacitySchema = z.object({
  userId: z.string(),
  dailyMinutes: z.number().int().min(0).max(24 * 60),
});
export type SetCapacityInput = z.infer<typeof setCapacitySchema>;

export const workloadQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});
export type WorkloadQuery = z.infer<typeof workloadQuerySchema>;
