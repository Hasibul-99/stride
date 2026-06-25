import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  AuthUser,
  ForgotPasswordInput,
  OtpPurpose,
  ResetPasswordInput,
  SigninInput,
  SignupInput,
  UpdateMeInput,
  VerifyEmailInput,
} from '@teamboard/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

interface OtpIssuedResponse {
  message: string;
  email: string;
}

/** Register: creates an unverified account + emails a code. Returns no token. */
export function useSignup() {
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const { data } = await api.post<OtpIssuedResponse>('/auth/signup', input);
      return data;
    },
  });
}

/** Verify the signup code → lands the user logged in (stores the token). */
export function useVerifyEmail() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: VerifyEmailInput) => {
      const { data } = await api.post<AuthResponse>('/auth/verify-email', input);
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: async (input: { email: string; purpose: OtpPurpose }) => {
      const { data } = await api.post<OtpIssuedResponse>('/auth/resend-otp', input);
      return data;
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const { data } = await api.post<{ message: string }>('/auth/forgot-password', input);
      return data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (input: ResetPasswordInput) => {
      const { data } = await api.post<{ message: string }>('/auth/reset-password', input);
      return data;
    },
  });
}

export function useSignin() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: SigninInput) => {
      const { data } = await api.post<AuthResponse>('/auth/signin', input);
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
  });
}

export function useLogout() {
  const clear = useAuthStore((s) => s.clear);
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSettled: () => clear(),
  });
}

/** Fetches the current user; used by the protected layout. */
export function useMe(enabled = true) {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['me'],
    enabled,
    queryFn: async () => {
      const { data } = await api.get<AuthUser>('/users/me');
      setUser(data);
      return data;
    },
  });
}

export function useUpdateMe() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: UpdateMeInput) => {
      const { data } = await api.patch<AuthUser>('/users/me', input);
      return data;
    },
    onSuccess: (data) => setUser(data),
  });
}
