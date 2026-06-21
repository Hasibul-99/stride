import { test, expect } from '@playwright/test';
import { dragTo, weekdayIso, signUp, createProject } from './helpers';

/**
 * Real-mouse drag of a task between two calendar days, proving the move
 * persists to the backend (survives a reload). Requires the full stack
 * (API + DB) running — see playwright.config.ts webServer + global-setup.
 */
test('dragging a task to another day persists after reload', async ({ page }) => {
  await signUp(page);
  await createProject(page, 'Drag Project');

  const monday = weekdayIso(0);
  const tuesday = weekdayIso(1);
  const mondayCol = page.locator(`[data-droppable-id="${monday}"]`);
  const tuesdayCol = page.locator(`[data-droppable-id="${tuesday}"]`);

  // Quick-add a task into Monday's column.
  await mondayCol.getByPlaceholder('+ Add task').fill('Drag me');
  await mondayCol.getByPlaceholder('+ Add task').press('Enter');
  await expect(mondayCol.getByText('Drag me')).toBeVisible();

  // Drag it to Tuesday.
  await dragTo(page, page.getByText('Drag me'), tuesdayCol);
  await expect(tuesdayCol.getByText('Drag me')).toBeVisible();

  // Reload → re-fetched from the API → still on Tuesday (write persisted).
  await page.reload();
  await expect(page.locator(`[data-droppable-id="${tuesday}"]`).getByText('Drag me')).toBeVisible();
  await expect(page.locator(`[data-droppable-id="${monday}"]`).getByText('Drag me')).toHaveCount(0);
});
