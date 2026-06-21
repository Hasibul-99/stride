import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Perform a real pointer drag from `source` to `target`.
 *
 * dnd-kit's PointerSensor only *starts* a drag after the pointer moves past its
 * activation distance (5px) AND it needs intermediate `pointermove` events to
 * track the drag — a single move won't trigger it. So we:
 *   1. move to the source centre and press the mouse down,
 *   2. nudge a few px to cross the activation threshold,
 *   3. move toward the target centre in several `steps` (emits intermediate moves),
 *   4. settle on the target, then release.
 *
 * Pass Locators (not selectors) so Playwright auto-waits for them.
 */
export async function dragTo(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const s = await source.boundingBox();
  const t = await target.boundingBox();
  if (!s || !t) throw new Error('dragTo: source or target has no bounding box');

  const sx = s.x + s.width / 2;
  const sy = s.y + s.height / 2;
  const tx = t.x + t.width / 2;
  const ty = t.y + t.height / 2;

  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 8, sy + 8, { steps: 5 }); // cross activation distance
  await page.mouse.move(tx, ty, { steps: 12 }); // travel with intermediate moves
  await page.mouse.move(tx, ty, { steps: 3 }); // settle so the drop target registers
  await page.mouse.up();
}

/** YYYY-MM-DD for a weekday in the current (Mon-start) week, in local time. */
export function weekdayIso(offsetFromMonday: number): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1) - day + offsetFromMonday;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

/** Sign up a brand-new account through the UI; lands on /app. */
export async function signUp(page: Page) {
  const email = `dnd_${Date.now()}@teamboard.local`;
  await page.goto('/auth/signup');
  await page.getByPlaceholder('Name').fill('DnD Tester');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder(/Password/).fill('password123');
  await page.getByRole('button', { name: /^sign up$/i }).click();
  await expect(page).toHaveURL(/\/app/);
  return email;
}

/** Create a project from the sidebar and open it. */
export async function createProject(page: Page, name: string) {
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByPlaceholder('Project name').fill(name);
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('link', { name: new RegExp(name) }).click();
}
