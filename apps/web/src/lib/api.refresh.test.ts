import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';
import { makeUser } from '@/test/factories';
import { useAuthStore } from '@/store/auth.store';
import { api } from './api';

const assignMock = vi.fn();

beforeEach(() => {
  useAuthStore.getState().clear();
  assignMock.mockClear();
  // jsdom's location.assign is non-configurable; replace the whole location object.
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { assign: assignMock, href: 'http://localhost/', origin: 'http://localhost' },
  });
});

describe('axios silent-refresh interceptor', () => {
  it('refreshes on 401 then retries the original request', async () => {
    let meCalls = 0;
    server.use(
      http.get('*/api/users/me', () => {
        meCalls += 1;
        return meCalls === 1
          ? new HttpResponse(null, { status: 401 })
          : HttpResponse.json(makeUser({ email: 'refreshed@x.com' }));
      }),
      http.post('*/api/auth/refresh', () => HttpResponse.json({ accessToken: 'fresh-token' })),
    );

    const res = await api.get('/users/me');

    expect(res.data.email).toBe('refreshed@x.com');
    expect(meCalls).toBe(2); // original + retry
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
  });

  it('bounces to /auth/signin when the refresh fails', async () => {
    useAuthStore.getState().setAccessToken('stale');
    server.use(
      http.get('*/api/users/me', () => new HttpResponse(null, { status: 401 })),
      http.post('*/api/auth/refresh', () => new HttpResponse(null, { status: 401 })),
    );

    await expect(api.get('/users/me')).rejects.toBeTruthy();

    expect(assignMock).toHaveBeenCalledWith('/auth/signin');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
