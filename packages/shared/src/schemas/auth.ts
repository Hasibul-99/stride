import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(120),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type SigninInput = z.infer<typeof signinSchema>;

export const updateMeSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  timezone: z.string().min(1).optional(),
});
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  timezone: string;
}

export interface AuthTokens {
  accessToken: string;
}
