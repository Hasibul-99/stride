import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** MSW server for Vitest (Node). Lifecycle wired in src/test/setup.ts. */
export const server = setupServer(...handlers);
