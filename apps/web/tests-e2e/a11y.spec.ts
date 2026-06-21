import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import { openProject } from './helpers';
import type { Page } from '@playwright/test';

/** Scan the current page; fail on any serious/critical WCAG violation. */
async function expectNoSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const summary = serious.map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} node(s)`).join('\n');
  expect(serious, `serious/critical a11y violations:\n${summary}`).toEqual([]);
}

test.describe('@a11y axe scans', () => {
  test('sign-in page', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expectNoSeriousA11y(page);
  });

  test('planner (project calendar)', async ({ page }) => {
    await openProject(page, 'Website Redesign');
    await expect(page.getByText('Waiting list')).toBeVisible();
    await expectNoSeriousA11y(page);
  });

  test('kanban', async ({ page }) => {
    await openProject(page, 'Website Redesign');
    await page.getByRole('button', { name: 'Kanban', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Manage statuses' })).toBeVisible();
    await expectNoSeriousA11y(page);
  });

  test('table', async ({ page }) => {
    await openProject(page, 'Website Redesign');
    await page.getByRole('button', { name: 'Table' }).click();
    await expect(page.getByRole('button', { name: 'Columns' })).toBeVisible();
    await expectNoSeriousA11y(page);
  });

  test('analytics dashboard (reports)', async ({ page }) => {
    await page.goto('/app/reports');
    await expect(page.getByRole('heading', { name: /Time reports/i })).toBeVisible();
    await expectNoSeriousA11y(page);
  });
});
