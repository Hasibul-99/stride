import { createHash, randomBytes } from 'node:crypto';

/** Random URL-safe token for invites. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Deterministic hash for tokens we must look up by value (e.g. invites). */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
