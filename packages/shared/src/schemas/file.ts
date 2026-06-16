import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '../constants.js';

export const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd',
  'text/',
];

const targetSchema = z
  .object({
    taskId: z.string().optional(),
    eventId: z.string().optional(),
    messageId: z.string().optional(),
  })
  .refine((t) => t.taskId || t.eventId || t.messageId, {
    message: 'one of taskId/eventId/messageId required',
  });

export const presignSchema = z.object({
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  mimeType: z.string().min(1),
  target: targetSchema,
});
export type PresignInput = z.infer<typeof presignSchema>;

export const confirmUploadSchema = z.object({
  s3Key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  mimeType: z.string().min(1),
  target: targetSchema,
});
export type ConfirmUploadInput = z.infer<typeof confirmUploadSchema>;
