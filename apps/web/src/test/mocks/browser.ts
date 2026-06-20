import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * MSW browser worker (for Storybook / manual dev mocking).
 * Requires the service worker file: `pnpm exec msw init public/ --save`.
 * Start in dev with: `worker.start()`.
 */
export const worker = setupWorker(...handlers);
