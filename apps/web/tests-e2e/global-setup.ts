import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FullConfig } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

/**
 * Reset + seed the database to a known state before the E2E run.
 * Uses the API package's idempotent seed (wipes, then reseeds demo data:
 * alice/bob/carol, projects, statuses, ~25 tasks this week, events, notes).
 * Best-effort: if the DB isn't reachable, log and continue so UI-only specs
 * (smoke) still run; the @e2e journeys require the full stack.
 */
export default async function globalSetup(_config: FullConfig) {
  try {
    execSync('pnpm --filter @teamboard/api db:seed', { cwd: repoRoot, stdio: 'inherit' });
    console.log('[e2e] database reset + seeded');
  } catch (err) {
    console.warn(`[e2e] db:seed failed (DB down?). Journey specs will fail. ${String(err)}`);
  }
}
