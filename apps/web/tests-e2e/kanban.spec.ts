import { test, expect } from './fixtures';
import { dragTo, openProject } from './helpers';

test('@e2e kanban: add a status, drag a task across columns, persists on reload', async ({ page }) => {
  await openProject(page, 'Website Redesign');
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();

  // Add a custom status.
  await page.getByRole('button', { name: 'Manage statuses' }).click();
  await page.getByPlaceholder('Status name').fill('QA');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('QA', { exact: true })).toBeVisible();

  // Quick-add a card in the "New" column.
  const newCol = page.locator('[data-droppable-id]', { hasText: 'New' }).first();
  await newCol.getByPlaceholder('+ Add task').fill('KanbanDrag');
  await newCol.getByPlaceholder('+ Add task').press('Enter');
  await expect(newCol.getByText('KanbanDrag')).toBeVisible();

  // Drag it onto a card in the "In progress" column (a concrete drop target).
  await dragTo(
    page,
    page.getByText('KanbanDrag'),
    page.locator('[data-draggable-id]', { hasText: 'Wireframe homepage' }),
  );
  const progressCol = page.locator('[data-droppable-id]', { hasText: 'In progress' }).first();
  await expect(progressCol.getByText('KanbanDrag')).toBeVisible();

  // Persists after reload.
  await page.reload();
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(
    page.locator('[data-droppable-id]', { hasText: 'In progress' }).first().getByText('KanbanDrag'),
  ).toBeVisible();
});
