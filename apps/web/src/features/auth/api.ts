import { useMutation, useQuery } from '@tanstack/react-query';
import type { AuthUser, SigninInput, SignupInput, UpdateMeInput } from '@teamboard/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

export function useSignup() {
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: async (input: SignupInput) => {
      const { data } = await api.post<AuthResponse>('/auth/signup', input);
      return data;
    },
    onSuccess: (data) => {
      setAccessToken(data.accessToken);
      setUser(data.user);
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
