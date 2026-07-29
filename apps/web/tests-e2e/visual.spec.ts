import { test as base, expect, type Page } from '@playwright/test';

/**
 * Visual-regression snapshots.
 *
 * Determinism strategy (so baselines don't flake):
 *  - Pin the timezone (America/New_York) via test.use below.
 *  - Freeze the clock to a fixed Monday (2026-06-15) with page.clock, so the
 *    week header, day numbers and the "today" column highlight are stable.
 *  - Build our OWN data per run via the API with fixed date strings tied to the
 *    frozen week — the shared db seed is real-"now"-relative, so its scheduled
 *    dates / timestamps would shift every day. A fresh account also means the
 *    analytics page has no stray time entries (deterministic empty overview).
 *  - No time entries or chat are created, so no relative timestamps render.
 *  - The live timer buttons are masked defensively.
 *
 * Snapshots are browser+OS specific. These are generated for chromium; regen
 * intentionally with `pnpm exec playwright test visual.spec.ts --update-snapshots`
 * (see doc/TESTING.md). Only chromium runs this file.
 */

const FROZEN = new Date('2026-06-15T12:00:00.000Z'); // a Monday
const MON = '2026-06-15';
const TUE = '2026-06-16';
const WED = '2026-06-17';
const THU = '2026-06-18';
const FRI = '2026-06-19';

interface Seeded {
  emptyId: string;
  dataId: string;
}

/** Create a fresh account + an empty project + a populated project via the API. */
async function seed(page: Page): Promise<Seeded> {
  const email = `visual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@teamboard.local`;
  const signup = await page.request.post('/api/auth/signup', {
    data: { name: 'Visual QA', email, password: 'password123' },
  });
  expect(signup.ok(), 'signup for visual seed should succeed').toBeTruthy();
  const { accessToken } = await signup.json();
  const headers = { Authorization: `Bearer ${accessToken}` };

  const workspaces = await (await page.request.get('/api/workspaces', { headers })).json();
  const workspaceId = workspaces[0].id as string;

  const empty = await (
    await page.request.post(`/api/workspaces/${workspaceId}/projects`, {
      headers,
      data: { name: 'Empty Project', color: 'slate' },
    })
  ).json();

  const data = await (
    await page.request.post(`/api/workspaces/${workspaceId}/projects`, {
      headers,
      data: { name: 'Website Redesign', color: 'blue' },
    })
  ).json();

  const statuses = await (
    await page.request.get(`/api/projects/${data.id}/statuses`, { headers })
  ).json();
  const id = Object.fromEntries(statuses.map((s: { name: string; id: string }) => [s.name, s.id]));

  const tasks = [
    { title: 'Audit current site analytics', statusId: id['Completed'], scheduledDate: MON, timeEstimateMinutes: 90 },
    { title: 'Define new sitemap', statusId: id['Completed'], scheduledDate: MON, timeEstimateMinutes: 120 },
    { title: 'Wireframe homepage', statusId: id['In progress'], scheduledDate: TUE, timeEstimateMinutes: 180 },
    { title: 'Wireframe pricing page', statusId: id['In progress'], scheduledDate: TUE, timeEstimateMinutes: 90 },
    { title: 'Draft hero copy', statusId: id['New'], scheduledDate: WED, timeEstimateMinutes: 60 },
    { title: 'Design system tokens', statusId: id['In progress'], scheduledDate: THU, timeEstimateMinutes: 240 },
    { title: 'SEO meta pass', statusId: id['New'], scheduledDate: FRI, timeEstimateMinutes: 60 },
    { title: 'Cookie consent banner', statusId: id['New'], timeEstimateMinutes: 90 },
    { title: 'Blog index template', statusId: id['New'], timeEstimateMinutes: 180 },
    { title: '404 page illustration', statusId: id['New'] },
  ];
  for (const t of tasks) {
    const res = await page.request.post(`/api/projects/${data.id}/tasks`, { headers, data: t });
    expect(res.ok(), `seed task "${t.title}"`).toBeTruthy();
  }

  return { emptyId: empty.id, dataId: data.id };
}

/** Mask non-deterministic widgets (the play/stop timer toggles). */
function masks(page: Page) {
  return { mask: [page.locator('button[title="Start timer"], button[title="Stop timer"]')] };
}

for (const device of [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
] as const) {
  const test = base.extend<{ seeded: Seeded }>({
    seeded: async ({ page }, use) => {
      await page.clock.install({ time: FROZEN });
      await page.clock.setFixedTime(FROZEN);
      const seeded = await seed(page);
      await use(seeded);
    },
  });

  test.describe(`@visual ${device.name}`, () => {
    test.skip(({ browserName }) => browserName !== 'chromium', 'baselines are chromium-only');
    test.use({ viewport: device.viewport, timezoneId: 'America/New_York' });

    test('empty planner', async ({ page, seeded }) => {
      await page.goto(`/app/projects/${seeded.emptyId}`);
      await expect(page.getByText('Waiting list')).toBeVisible();
      await expect(page.getByPlaceholder('+ Add task').first()).toBeVisible();
      await expect(page).toHaveScreenshot(`planner-empty-${device.name}.png`, masks(page));
    });

    test('planner with data', async ({ page, seeded }) => {
      await page.goto(`/app/projects/${seeded.dataId}`);
      await expect(page.getByRole('button', { name: 'Wireframe homepage' })).toBeVisible();
      await expect(page).toHaveScreenshot(`planner-data-${device.name}.png`, masks(page));
    });

    test('kanban', async ({ page, seeded }) => {
      await page.goto(`/app/projects/${seeded.dataId}`);
      await page.getByRole('button', { name: 'Kanban', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Manage statuses' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Wireframe homepage' })).toBeVisible();
      await expect(page).toHaveScreenshot(`kanban-${device.name}.png`, masks(page));
    });

    test('table', async ({ page, seeded }) => {
      await page.goto(`/app/projects/${seeded.dataId}`);
      await page.getByRole('button', { name: 'Table' }).click();
      await expect(page.getByRole('button', { name: 'Columns' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: 'Task title' }).first()).toBeVisible();
      await expect(page).toHaveScreenshot(`table-${device.name}.png`, masks(page));
    });

    test('task drawer', async ({ page, seeded }) => {
      await page.goto(`/app/projects/${seeded.dataId}`);
      await page.getByRole('button', { name: 'Wireframe homepage' }).click();
      const drawer = page.getByRole('dialog', { name: 'Task details' });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText('No time logged.')).toBeVisible();
      await expect(drawer).toHaveScreenshot(`task-drawer-${device.name}.png`, masks(page));
    });

    test('analytics overview', async ({ page, seeded: _seeded }) => {
      await page.goto('/app/reports');
      await expect(page.getByRole('heading', { name: /Time reports/i })).toBeVisible();
      await expect(page.getByText('Total:')).toBeVisible();
      await expect(page).toHaveScreenshot(`analytics-${device.name}.png`, masks(page));
    });
  });
}
