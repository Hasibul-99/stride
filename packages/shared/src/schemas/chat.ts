import { z } from 'zod';

export const sendMessageSchema = z.object({
  taskId: z.string(),
  body: z.string().min(1).max(5000),
  mentions: z.array(z.string()).default([]),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const editMessageSchema = z.object({
  messageId: z.string(),
  body: z.string().min(1).max(5000),
});
export type EditMessageInput = z.infer<typeof editMessageSchema>;

export const deleteMessageSchema = z.object({
  messageId: z.string(),
});
export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;

export const typingSchema = z.object({
  taskId: z.string(),
});
export type TypingInput = z.infer<typeof typingSchema>;

// Socket event names (client ↔ server).
export const SOCKET_EVENTS = {
  joinTask: 'task:join',
  leaveTask: 'task:leave',
  joinProject: 'project:join',
  leaveProject: 'project:leave',
  chatSend: 'chat:send',
  chatEdit: 'chat:edit',
  chatDelete: 'chat:delete',
  chatTyping: 'chat:typing',
  chatNew: 'chat:new',
  chatUpdated: 'chat:updated',
  chatDeleted: 'chat:deleted',
  typingPing: 'chat:typing-ping',
  boardChanged: 'board:changed',
  notificationNew: 'notification:new',
} as const;
