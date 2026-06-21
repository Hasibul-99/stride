import { test, expect } from './fixtures';
import { openProject } from './helpers';

test('@e2e time tracking: start → header pill → navigate → stop → entry recorded', async ({ page }) => {
  await openProject(page, 'Website Redesign');

  const card = page.locator('[data-draggable-id]', { hasText: 'Wireframe homepage' });
  await expect(card).toBeVisible();

  // Start the timer from the card.
  await card.getByTitle('Start timer').click();

  // Header pill shows it running.
  const stopPill = page.getByRole('button', { name: 'Stop' });
  await expect(stopPill).toBeVisible();

  // Navigate away and back; the timer keeps running.
  await page.goto('/app/workload');
  await expect(page.getByRole('heading', { name: 'Workload' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await openProject(page, 'Website Redesign');

  // Stop it.
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toHaveCount(0);

  // Drawer shows a recorded entry.
  await page.locator('[data-draggable-id]', { hasText: 'Wireframe homepage' }).getByText('Wireframe homepage').click();
  await expect(page.getByText('Time', { exact: true })).toBeVisible();
  await expect(page.getByText(/Alice Chen ·/)).toBeVisible(); // an entry row
});
