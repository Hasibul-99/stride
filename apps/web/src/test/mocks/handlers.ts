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
];
