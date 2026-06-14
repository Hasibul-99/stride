import { z } from 'zod';
import { PROJECT_COLORS } from '../constants.js';

// TipTap rich-text document is stored as opaque JSON.
const richTextJson = z.unknown();

// 'YYYY-MM-DD' date-only string (or null = waiting list).
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .nullable();

// ─── Tasks ───────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: richTextJson.optional(),
  statusId: z.string().optional(), // defaults to project's default status
  assigneeId: z.string().nullable().optional(),
  scheduledDate: dateOnly.optional(),
  timeEstimateMinutes: z.number().int().min(0).nullable().optional(),
  position: z.number().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: richTextJson.optional(),
  statusId: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  scheduledDate: dateOnly.optional(),
  timeEstimateMinutes: z.number().int().min(0).nullable().optional(),
  position: z.number().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const taskQuerySchema = z.object({
  scheduledFrom: z.string().optional(),
  scheduledTo: z.string().optional(),
  waitingList: z.coerce.boolean().optional(),
  assigneeId: z.string().optional(),
  statusId: z.string().optional(),
  includeCompleted: z.coerce.boolean().optional(),
});
export type TaskQuery = z.infer<typeof taskQuerySchema>;

// Bulk drag-and-drop position updates, applied in one transaction.
export const bulkPositionsSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string(),
        statusId: z.string().optional(),
        scheduledDate: dateOnly.optional(),
        position: z.number(),
      }),
    )
    .min(1),
});
export type BulkPositionsInput = z.infer<typeof bulkPositionsSchema>;

// ─── Statuses ────────────────────────────────────────────

export const createStatusSchema = z.object({
  name: z.string().min(1).max(60),
  color: z.enum(PROJECT_COLORS).default('slate'),
  isCompleted: z.boolean().default(false),
});
export type CreateStatusInput = z.infer<typeof createStatusSchema>;

export const updateStatusSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  color: z.enum(PROJECT_COLORS).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().optional(),
});
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const deleteStatusSchema = z.object({
  targetStatusId: z.string().min(1),
});
export type DeleteStatusInput = z.infer<typeof deleteStatusSchema>;
