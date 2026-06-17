import { z } from 'zod';

/** Notification types that can fire an email digest. */
export const HIGH_VALUE_NOTIF_TYPES = ['TASK_ASSIGNED', 'MENTION', 'INVITE'] as const;

export const notifPrefEntry = z.object({
  inApp: z.boolean().default(true),
  email: z.boolean().default(true),
});

export const updateNotifPrefsSchema = z.object({
  emailNotifications: z.boolean().optional(),
  prefs: z.record(z.string(), notifPrefEntry).optional(),
});
export type UpdateNotifPrefsInput = z.infer<typeof updateNotifPrefsSchema>;
