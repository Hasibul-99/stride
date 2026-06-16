import { z } from 'zod';

const richTextJson = z.unknown();

export const createNoteSchema = z.object({
  title: z.string().min(1).max(200).default('Untitled'),
  content: richTextJson.optional(),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: richTextJson.optional(),
  position: z.number().optional(),
});
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export interface SearchResults {
  tasks: { id: string; title: string; projectId: string; projectName: string }[];
  notes: { id: string; title: string; projectId: string; projectName: string }[];
}
