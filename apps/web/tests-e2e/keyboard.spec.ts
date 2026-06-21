import { test, expect } from './fixtures';
import { openProject } from './helpers';
import type { Page } from '@playwright/test';

/** Accessible identity of the currently focused element (for order assertions). */
function activeId(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return null;
    return (
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.textContent?.trim().slice(0, 40) ||
      el.tagName.toLowerCase()
    );
  });
}

/** Is the focused element inside the open dialog? */
function focusInDialog(page: Page) {
  return page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return !!dlg && !!document.activeElement && dlg.contains(document.activeElement);
  });
}

test.describe('@keyboard navigation', () => {
  test('task drawer: focus enters and tab order is logical', async ({ page }) => {
    await openProject(page, 'Website Redesign');
    await page.getByRole('button', { name: 'Cookie consent banner' }).click();

    const drawer = page.getByRole('dialog', { name: 'Task details' });
    await expect(drawer).toBeVisible();

    // Focus moves into the drawer, onto the first control (← Close).
    await expect.poll(() => activeId(page)).toBe('← Close');

    // Tabbing walks the controls in visual top-to-bottom order.
    await page.keyboard.press('Tab');
    await expect.poll(() => activeId(page)).toBe('Delete');
    await page.keyboard.press('Tab');
    await expect.poll(() => activeId(page)).toBe('Task title');
    await page.keyboard.press('Tab');
    await expect.poll(() => activeId(page)).toBe('Status'); // StatusSelect
    await page.keyboard.press('Tab');
    await expect.poll(() => activeId(page)).toBe('Assignee');

    // Escape closes the drawer.
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('modal: focus is trapped and returns to the trigger on close', async ({ page }) => {
    await page.goto('/app');
    const trigger = page.getByRole('button', { name: 'New project' });
    await trigger.click();

    const modal = page.getByRole('dialog', { name: 'New project' });
    await expect(modal).toBeVisible();
    await expect.poll(() => focusInDialog(page)).toBe(true);

    // Tab well past the number of controls — focus must never escape the dialog.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await focusInDialog(page)).toBe(true);
    }
    // Shift+Tab wraps backwards within the dialog too.
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusInDialog(page)).toBe(true);
    }

    // Escape closes the modal and restores focus to the button that opened it.
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('dnd-kit keyboard drag reorders the waiting list', async ({ page }) => {
    await openProject(page, 'Website Redesign');

    const cards = page.locator('[data-droppable-id="waiting"] [data-draggable-id]');
    await expect(cards.first()).toBeVisible();
    const before = (await cards.allInnerTexts()).map((t) => t.trim());
    expect(before.length).toBeGreaterThan(1);

    // Pick up the first card with the keyboard, move it down one slot, drop it.
    await cards.first().focus();
    await page.keyboard.press('Space'); // grab
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowDown'); // move past the next item
    await page.waitForTimeout(150);
    await page.keyboard.press('Space'); // drop
    await page.waitForTimeout(150);

    // The first two cards have swapped (and the move persists after refetch).
    await expect
      .poll(async () => (await cards.allInnerTexts()).map((t) => t.trim()))
      .toEqual([before[1], before[0], ...before.slice(2)]);
  });
});
