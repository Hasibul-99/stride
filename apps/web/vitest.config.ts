import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Deterministic timezone for date-sensitive tests (override per-test with pinTimezone).
    env: { TZ: 'America/New_York' },
    // Unit/integration tests live in src; Playwright specs live in tests-e2e.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'tests-e2e', 'e2e'],
    coverage: {
      provider: 'v8',
      // text + summary for the CI log, html for the artifact, lcov for external tools.
      reporter: ['text', 'text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Test scaffolding, generated, and config.
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        // Route shells, pages, and thin data-layer hooks are exercised by the
        // Playwright E2E layer, not unit tests — keep them out of the unit gate
        // so the floor reflects logic/component coverage we actually assert here.
        'src/router.tsx',
        'src/app/**',
        'src/**/*Page.tsx',
        'src/**/api.ts',
        'src/features/marketing/**',
        'src/features/design/**',
        'src/lib/socket.ts',
      ],
      // No-regression floor (start realistic; ratchet up as tests land).
      // Pure-logic utils are held to a much higher bar per-file.
      thresholds: {
        lines: 48,
        statements: 48,
        functions: 45,
        branches: 70,
        '**/src/features/tasks/positions.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        '**/src/features/calendar/drop.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        '**/src/features/calendar/week.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        '**/src/features/kanban/drop.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
        '**/src/lib/utils.ts': { lines: 90, functions: 90, branches: 90, statements: 90 },
      },
    },
  },
});
