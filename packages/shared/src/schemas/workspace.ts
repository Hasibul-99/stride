import { z } from 'zod';
import { PROJECT_COLORS, PROJECT_ROLES, WORKSPACE_ROLES } from '../constants.js';

// ─── Workspace ───────────────────────────────────────────

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
  logoUrl: z.string().url().nullable().optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = createWorkspaceSchema.partial();
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

// ─── Folders ─────────────────────────────────────────────

export const createFolderSchema = z.object({
  name: z.string().min(1).max(120),
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  position: z.number().optional(),
});
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

// ─── Projects ────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.enum(PROJECT_COLORS).default('blue'),
  description: z.string().max(2000).nullable().optional(),
  folderId: z.string().nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.enum(PROJECT_COLORS).optional(),
  description: z.string().max(2000).nullable().optional(),
  folderId: z.string().nullable().optional(),
  position: z.number().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

// ─── Members & invites ───────────────────────────────────

export const addProjectMemberSchema = z.object({
  userId: z.string().optional(), // existing workspace member
  email: z.string().email().optional(), // invite a guest by email
  role: z.enum(PROJECT_ROLES).default('MEMBER'),
});
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(WORKSPACE_ROLES).default('MEMBER'),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
