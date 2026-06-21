import { test, expect, type Browser, type APIRequestContext } from '@playwright/test';
import { ALICE } from './constants';
import { dragTo, weekdayIso } from './helpers';

/**
 * Realtime: two browser contexts (two members of one project) against the same
 * backend. Slower — tagged @realtime. Each test seeds its own project + task so
 * runs don't interfere.
 */
const BOB = { email: 'bob@teamboard.local', password: 'password123' };
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

interface Status {
  id: string;
  name: string;
}

async function bearer(request: APIRequestContext, creds: { email: string; password: string }) {
  const res = await request.post('/api/auth/signin', { data: creds });
  expect(res.ok(), 'API sign-in should succeed (API + seed up?)').toBeTruthy();
  return (await res.json()).accessToken as string;
}

/** Create a fresh project (alice), add bob as a member; returns ids + statuses. */
async function seedSharedProject(request: APIRequestContext) {
  const token = await bearer(request, ALICE);
  const H = { headers: { Authorization: `Bearer ${token}` } };
  const ws = (await (await request.get('/api/workspaces', H)).json())[0].id;
  const members = (await (await request.get(`/api/workspaces/${ws}/members`, H)).json()) as {
    user: { id: string; email: string };
  }[];
  const bobId = members.find((m) => m.user.email === BOB.email)!.user.id;

  const project = await (
    await request.post(`/api/workspaces/${ws}/projects`, {
      ...H,
      data: { name: `RT ${Date.now()}`, color: 'blue' },
    })
  ).json();
  await request.post(`/api/projects/${project.id}/members`, { ...H, data: { userId: bobId } });
  const statuses = (await (await request.get(`/api/projects/${project.id}/statuses`, H)).json()) as Status[];

  async function createTask(data: Record<string, unknown>) {
    return (await request.post(`/api/projects/${project.id}/tasks`, { ...H, data })).json();
  }
  return { projectId: project.id, statuses, aliceToken: token, createTask, headers: H };
}

/** New context signed in as `creds`, opened at `path`. Returns page + token. */
async function openAs(
  browser: Browser,
  creds: { email: string; password: string },
  path: string,
) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const token = (await (await page.request.post('/api/auth/signin', { data: creds })).json())
    .accessToken as string;
  await page.goto(path);
  return { context, page, token };
}

test.describe('@realtime two-user sync', () => {
  test('A drags a task to a new day → B sees it move without reloading', async ({ browser, request }) => {
    const { projectId, createTask } = await seedSharedProject(request);
    const monday = weekdayIso(0);
    const tuesday = weekdayIso(1);
    await createTask({ title: 'RT Move', scheduledDate: monday });

    const a = await openAs(browser, ALICE, `/app/projects/${projectId}`);
    const b = await openAs(browser, BOB, `/app/projects/${projectId}`);

    const aMon = a.page.locator(`[data-droppable-id="${monday}"]`);
    const bMon = b.page.locator(`[data-droppable-id="${monday}"]`);
    const bTue = b.page.locator(`[data-droppable-id="${tuesday}"]`);
    await expect(aMon.getByText('RT Move')).toBeVisible();
    await expect(bMon.getByText('RT Move')).toBeVisible();

    // A drags Mon → Tue.
    await dragTo(a.page, aMon.getByText('RT Move'), a.page.locator(`[data-droppable-id="${tuesday}"]`));

    // B's board updates live (no reload).
    await expect(bTue.getByText('RT Move')).toBeVisible({ timeout: 8000 });
    await expect(bMon.getByText('RT Move')).toHaveCount(0);

    await a.context.close();
    await b.context.close();
  });

  test('A posts a chat message → B sees it; unread behaves correctly', async ({ browser, request }) => {
    const { projectId, createTask } = await seedSharedProject(request);
    const task = await createTask({ title: 'RT Chat', scheduledDate: weekdayIso(0) });

    const a = await openAs(browser, ALICE, `/app/projects/${projectId}`);
    const b = await openAs(browser, BOB, `/app/projects/${projectId}`);

    // Both open the task (join its chat room).
    await a.page.getByText('RT Chat').click();
    await b.page.getByText('RT Chat').click();
    await expect(a.page.getByText('No messages yet.')).toBeVisible();

    // A sends → B sees it live.
    await a.page.getByPlaceholder('Message…').fill('hello from A');
    await a.page.getByRole('button', { name: 'Send' }).click();
    await expect(b.page.getByText('hello from A')).toBeVisible({ timeout: 8000 });

    // B had it open → no unread for B.
    const bUnread = async () =>
      (
        await b.page.request.get(`/api/tasks/${task.id}/chat/unread`, {
          headers: { Authorization: `Bearer ${b.token}` },
        })
      ).json();
    await expect.poll(async () => (await bUnread()).count).toBe(0);

    // B closes the drawer; A sends again → B accrues an unread.
    await b.page.getByRole('button', { name: /Close/ }).click();
    await a.page.getByPlaceholder('Message…').fill('second message');
    await a.page.getByRole('button', { name: 'Send' }).click();
    await expect.poll(async () => (await bUnread()).count, { timeout: 8000 }).toBeGreaterThan(0);

    // B reopens → sees it and unread clears.
    await b.page.getByText('RT Chat').click();
    await expect(b.page.getByText('second message')).toBeVisible();
    await expect.poll(async () => (await bUnread()).count).toBe(0);

    await a.context.close();
    await b.context.close();
  });

  test('A changes a task status → B kanban column updates', async ({ browser, request }) => {
    const { projectId, statuses, createTask } = await seedSharedProject(request);
    const newStatus = statuses.find((s) => s.name === 'New')!;
    const inProgress = statuses.find((s) => s.name === 'In progress')!;
    await createTask({ title: 'RT Status', statusId: newStatus.id });

    const a = await openAs(browser, ALICE, `/app/projects/${projectId}`);
    const b = await openAs(browser, BOB, `/app/projects/${projectId}`);
    await a.page.getByRole('button', { name: 'Kanban', exact: true }).click();
    await b.page.getByRole('button', { name: 'Kanban', exact: true }).click();

    const bInProgressCol = b.page.locator('[data-droppable-id]', { hasText: 'In progress' }).first();
    await expect(bInProgressCol.getByText('RT Status')).toHaveCount(0);

    // A moves it to In progress via the drawer.
    await a.page.getByText('RT Status').click();
    await a.page.getByLabel('Status').selectOption(inProgress.id);
    await a.page.getByRole('button', { name: /Close/ }).click();

    // B's In progress column gains the card live.
    await expect(bInProgressCol.getByText('RT Status')).toBeVisible({ timeout: 8000 });

    await a.context.close();
    await b.context.close();
  });

  test('B reconnects after going offline → state resyncs to match A', async ({ browser, request }) => {
    const { projectId, createTask } = await seedSharedProject(request);
    const monday = weekdayIso(0);
    const tuesday = weekdayIso(1);
    await createTask({ title: 'RT Reconnect', scheduledDate: monday });

    const a = await openAs(browser, ALICE, `/app/projects/${projectId}`);
    const b = await openAs(browser, BOB, `/app/projects/${projectId}`);
    await expect(b.page.locator(`[data-droppable-id="${monday}"]`).getByText('RT Reconnect')).toBeVisible();

    // B goes offline; A moves the task while B can't hear it.
    await b.context.setOffline(true);
    await dragTo(
      a.page,
      a.page.locator(`[data-droppable-id="${monday}"]`).getByText('RT Reconnect'),
      a.page.locator(`[data-droppable-id="${tuesday}"]`),
    );
    await expect(a.page.locator(`[data-droppable-id="${tuesday}"]`).getByText('RT Reconnect')).toBeVisible();

    // B comes back online → resyncs to A's state.
    await b.context.setOffline(false);
    await expect(
      b.page.locator(`[data-droppable-id="${tuesday}"]`).getByText('RT Reconnect'),
    ).toBeVisible({ timeout: 15000 });
    await expect(b.page.locator(`[data-droppable-id="${monday}"]`).getByText('RT Reconnect')).toHaveCount(0);

    await a.context.close();
    await b.context.close();
  });
});
