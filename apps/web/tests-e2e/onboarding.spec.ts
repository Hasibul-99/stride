import { test, expect } from '@playwright/test';
import { signUp, createProject } from './helpers';

// Fresh signup — do NOT reuse the saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test('@e2e onboarding: sign up → personal workspace → create project → sidebar', async ({ page }) => {
  await signUp(page);

  // A personal workspace was created automatically.
  await expect(page.locator('select').first()).toContainText('My Workspace');

  // Create a project, choosing a palette color.
  await createProject(page, 'Launch Plan', 'violet');

  // It opens and shows in the sidebar.
  await expect(page.getByRole('heading', { name: 'Launch Plan' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Launch Plan/ })).toBeVisible();
});
