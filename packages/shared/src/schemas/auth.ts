import { z } from 'zod';
import { OTP_LENGTH, OTP_PURPOSES } from '../constants.js';

/** Exactly OTP_LENGTH numeric digits. */
const otpCode = z
  .string()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Code must be ${OTP_LENGTH} digits`);

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

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: otpCode,
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendOtpSchema = z.object({
  email: z.string().email(),
  purpose: z.enum(OTP_PURPOSES),
});
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    email: z.string().email(),
    code: otpCode,
    password: z.string().min(8, 'Password must be at least 8 characters'),
    passwordConfirmation: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirmation, {
    message: 'Passwords do not match',
    path: ['passwordConfirmation'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

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
