import { http, HttpResponse } from 'msw';
import { signinSchema, signupSchema } from '@teamboard/shared';
import { makeProject, makeStatus, makeTask, makeUser } from '../factories';

/**
 * Starter MSW handlers. Request bodies are validated against the shared zod
 * schemas; responses are built from the factories (which mirror API shapes).
 * Paths use a leading wildcard so relative axios calls (baseURL `/api`) match
 * under jsdom (where requests resolve against http://localhost).
 */
const DEMO_USER = makeUser({ id: 'user_demo', email: 'alice@teamboard.local', name: 'Alice Chen' });
const ACCESS_TOKEN = 'test.access.token';

export const handlers = [
  http.post('*/api/auth/signin', async ({ request }) => {
    const parsed = signinSchema.safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ message: 'Invalid' }, { status: 400 });
    return HttpResponse.json({ accessToken: ACCESS_TOKEN, user: DEMO_USER });
  }),

  http.post('*/api/auth/signup', async ({ request }) => {
    const parsed = signupSchema.safeParse(await request.json());
    if (!parsed.success) return HttpResponse.json({ message: 'Invalid' }, { status: 400 });
    return HttpResponse.json({ accessToken: ACCESS_TOKEN, user: makeUser({ name: parsed.data.name }) });
  }),

  http.post('*/api/auth/refresh', () =>
    HttpResponse.json({ accessToken: ACCESS_TOKEN }),
  ),

  http.post('*/api/auth/logout', () => new HttpResponse(null, { status: 204 })),

  http.get('*/api/users/me', () => HttpResponse.json(DEMO_USER)),

  http.get('*/api/workspaces', () =>
    HttpResponse.json([{ id: 'ws_0001', name: 'Acme Studio', logoUrl: null, role: 'OWNER' }]),
  ),

  http.get('*/api/workspaces/:id/projects', () =>
    HttpResponse.json([makeProject({ id: 'proj_0001', name: 'Website Redesign' })]),
  ),

  http.get('*/api/projects/:id/statuses', () =>
    HttpResponse.json([
      makeStatus({ id: 'status_new', name: 'New', isDefault: true }),
      makeStatus({ id: 'status_done', name: 'Completed', color: 'green', isCompleted: true }),
    ]),
  ),

  http.get('*/api/projects/:id/tasks', () =>
    HttpResponse.json([makeTask({ id: 'task_0001', statusId: 'status_new' })]),
  ),

  http.get('*/api/projects/:id/members', () =>
    HttpResponse.json([
      { id: 'pm1', role: 'MANAGER', user: makeUser({ id: 'u_alice', name: 'Alice Chen' }) },
      { id: 'pm2', role: 'MEMBER', user: makeUser({ id: 'u_bob', name: 'Bob Martins' }) },
    ]),
  ),

  // No timer running by default; TimerPill tests override with server.use(...).
  http.get('*/api/time/running', () => HttpResponse.json(null)),

  // Task sub-resources (drawer panels) — empty defaults; override per test.
  http.get('*/api/tasks/:id/time', () => HttpResponse.json({ entries: [], totalSeconds: 0 })),
  http.get('*/api/tasks/:id/files', () => HttpResponse.json([])),
  http.get('*/api/tasks/:id/chat', () => HttpResponse.json({ messages: [], nextCursor: null })),
  http.get('*/api/tasks/:id/chat/unread', () => HttpResponse.json({ count: 0 })),
  http.post('*/api/tasks/:id/chat/read', () => HttpResponse.json({ read: 0 })),

  // Generic task PATCH echo (override per test to assert payloads / force errors).
  http.patch('*/api/tasks/:id', async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: params.id, ...body });
  }),

  // Notifications defaults.
  http.get('*/api/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
  http.get('*/api/notifications', () => HttpResponse.json({ items: [], nextCursor: null })),
];
