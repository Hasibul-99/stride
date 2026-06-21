import { test, expect } from './fixtures';
import { dragTo, openProject, todayIso } from './helpers';

test('@e2e task lifecycle: waiting list → today → estimate/assignee → complete', async ({ page }) => {
  await openProject(page, 'Website Redesign');

  const today = todayIso();
  const waiting = page.locator('[data-droppable-id="waiting"]');
  const todayCol = page.locator(`[data-droppable-id="${today}"]`);

  // Create on the waiting list.
  await waiting.getByPlaceholder('+ Add task').fill('E2E Lifecycle');
  await waiting.getByPlaceholder('+ Add task').press('Enter');
  await expect(waiting.getByText('E2E Lifecycle')).toBeVisible();

  // Drag it onto today; it leaves the waiting list.
  await dragTo(page, waiting.getByText('E2E Lifecycle'), todayCol);
  await expect(todayCol.getByText('E2E Lifecycle')).toBeVisible();
  await expect(waiting.getByText('E2E Lifecycle')).toHaveCount(0);

  // Open the drawer; set estimate + assignee.
  await todayCol.getByText('E2E Lifecycle').click();
  await page.getByLabel('Time estimate').fill('2h');
  await page.getByLabel('Time estimate').blur();
  await page.getByLabel('Assignee').selectOption({ label: 'Alice Chen' });

  // Complete it (move to a completed status), then close the drawer.
  await page.getByLabel('Status').selectOption({ label: 'Completed ✓' });
  await page.getByRole('button', { name: /Close/ }).click();

  // Card renders completed (greyed + check) on today, and its estimate counts.
  const card = todayCol.locator('[data-draggable-id]', { hasText: 'E2E Lifecycle' });
  await expect(card.getByLabel('Completed')).toBeVisible();
  await expect(todayCol.getByText('2h').first()).toBeVisible();
});
