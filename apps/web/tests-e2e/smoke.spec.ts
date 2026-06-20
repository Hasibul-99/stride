import { test, expect } from '@playwright/test';

test('sign-in page renders the form', async ({ page }) => {
  await page.goto('/auth/signin');

  await expect(page.getByRole('heading', { name: /sign in to teamboard/i })).toBeVisible();
  await expect(page.getByPlaceholder('Email')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
});
