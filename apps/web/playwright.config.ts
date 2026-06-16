import { defineConfig, devices } from '@playwright/test';

/**
 * Critical-flow e2e. Requires the stack running (API :3000, web :5173) and
 * browsers installed (`pnpm exec playwright install chromium`).
 * Run: `pnpm --filter @teamboard/web e2e`
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
