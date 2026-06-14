import { randomUUID } from 'node:crypto';

/** Opaque unique id for tokens/jti. UUID is sufficient (not stored as cuid). */
export function createId(): string {
  return randomUUID();
}
