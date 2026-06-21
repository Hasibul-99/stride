import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config.
 * - globalSetup resets + seeds the test database to a known state.
 * - authenticated specs import the fixture in tests-e2e/fixtures.ts, which
 *   logs in via the API per test (refresh-token rotation makes a shared
 *   storageState single-use, so we mint a fresh session each test — still no
 *   login UI). Onboarding uses the plain test (fresh signup).
 * Browsers: `pnpm exec playwright install chromium webkit`.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests-e2e',
  globalSetup: './tests-e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
