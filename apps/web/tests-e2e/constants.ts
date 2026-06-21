import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Saved login (refresh cookie) reused by authenticated specs. */
export const authFile = path.join(here, '.auth', 'alice.json');

/** Seeded demo account (created by global-setup's db:seed). */
export const ALICE = { email: 'alice@teamboard.local', password: 'password123' };

/** Mailpit HTTP API (local SMTP capture). */
export const MAILPIT_API = process.env.MAILPIT_API ?? 'http://localhost:8025';
