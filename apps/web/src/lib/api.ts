import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth.store';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send the httpOnly refresh cookie
});

// Attach the in-memory access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await axios.post<{ accessToken: string }>(
      '/api/auth/refresh',
      {},
      { withCredentials: true },
    );
    const token = res.data.accessToken;
    useAuthStore.getState().setAccessToken(token);
    return token;
  } catch {
    useAuthStore.getState().clear();
    return null;
  }
}

// Silent refresh on 401, then retry the original request once.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const isAuthEndpoint = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      refreshing ??= refreshAccessToken();
      const token = await refreshing;
      refreshing = null;

      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      // Refresh failed → redirect to sign-in.
      window.location.assign('/auth/signin');
    }
    return Promise.reject(error);
  },
);
