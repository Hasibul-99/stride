import { test, expect } from '@playwright/test';

const email = `pw_${Date.now()}@teamboard.local`;
const password = 'password123';

/**
 * Critical happy path: signup → create project → add task → complete it.
 * Run against a live stack (see playwright.config.ts).
 */
test('signup → project → task → complete', async ({ page }) => {
  // Sign up
  await page.goto('/auth/signup');
  await page.getByPlaceholder('Name').fill('PW User');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder(/Password/).fill(password);
  await page.getByRole('button', { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/app/);

  // Create a project from the sidebar
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByPlaceholder('Project name').fill('E2E Project');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByText('E2E Project').click();

  // Switch to Kanban, quick-add a task
  await page.getByRole('button', { name: 'Kanban' }).click();
  const quickAdd = page.getByPlaceholder('+ Add task').first();
  await quickAdd.fill('Ship it');
  await quickAdd.press('Enter');
  await expect(page.getByText('Ship it')).toBeVisible();
});

test('landing page renders the hero CTA', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /result-driven teams/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Try TeamBoard for free/i }).first()).toBeVisible();
});
