import type { FullConfig } from '@playwright/test';

const API = process.env.E2E_API_URL ?? 'http://localhost:3000/api';

/** Known account E2E specs can rely on. */
export const E2E_USER = {
  email: 'e2e@teamboard.local',
  password: 'password123',
  name: 'E2E User',
};

/**
 * Seed a known database state via the API before the suite runs.
 * Best-effort: if the API isn't reachable, log and continue so UI-only specs
 * (e.g. the signin form smoke test) still run.
 */
export default async function globalSetup(_config: FullConfig) {
  try {
    const res = await fetch(`${API}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(E2E_USER),
    });
    if (res.ok) {
      console.log(`[e2e] seeded user ${E2E_USER.email}`);
    } else if (res.status === 409) {
      console.log(`[e2e] user ${E2E_USER.email} already exists`);
    } else {
      console.warn(`[e2e] seed returned ${res.status}`);
    }
  } catch (err) {
    console.warn(`[e2e] API not reachable for seeding (${String(err)}). UI-only specs will still run.`);
  }
}
