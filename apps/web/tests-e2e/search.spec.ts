import { test, expect } from './fixtures';

test('@e2e search: Cmd+K → type a task title → Enter lands on it', async ({ page }) => {
  await page.goto('/app');
  await expect(page.getByText('Projects')).toBeVisible(); // app loaded

  await page.locator('body').click(); // ensure the window has focus
  await page.keyboard.press('ControlOrMeta+k');
  const input = page.getByPlaceholder('Search tasks and notes…');
  await expect(input).toBeVisible();

  await input.fill('Wireframe');
  // Wait for the result, then Enter opens the first hit.
  await expect(page.getByText('Wireframe homepage')).toBeVisible();
  await input.press('Enter');

  await expect(page).toHaveURL(/\/app\/projects\//);
  await expect(page.getByRole('heading', { name: 'Website Redesign' })).toBeVisible();
});
