import { test as base, expect } from '@playwright/test';
import { ALICE } from './constants';

/**
 * Authenticated test fixture.
 *
 * The app rotates refresh tokens on every silent refresh, so a single saved
 * storageState is only good for ONE page load — reusing it across tests fails
 * after the first rotation. Instead we mint a fresh session per test via the
 * API (POST /auth/signin sets the httpOnly refresh cookie in this context),
 * which still skips the login UI and is robust to rotation. The app's
 * silent-refresh then restores the access token on first navigation.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const res = await page.request.post('/api/auth/signin', { data: ALICE });
    expect(res.ok(), 'API sign-in for alice should succeed (is the API + seed up?)').toBeTruthy();
    await use(page);
  },
});

export { expect };
