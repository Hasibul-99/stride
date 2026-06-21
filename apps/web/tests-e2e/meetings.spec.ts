import { test, expect } from './fixtures';
import { MAILPIT_API } from './constants';
import { openProject, todayIso } from './helpers';

test('@e2e meetings: create event with external participant → ICS emailed → shown in drawer', async ({
  page,
  request,
}) => {
  const email = `ext_${Date.now()}@external.test`;
  await openProject(page, 'Website Redesign');

  // Open the event modal from the calendar toolbar.
  await page.getByRole('button', { name: '+ Event' }).click();
  await page.getByPlaceholder('Title').fill('E2E Sync');
  await page.locator('input[type="date"]').fill(todayIso());
  const emailField = page.getByPlaceholder(/Invite by email/);
  await emailField.fill(email);
  await emailField.press('Enter');
  await expect(page.getByText(email)).toBeVisible(); // chip added
  await page.getByRole('button', { name: 'Create' }).click();

  // Event renders on today's column.
  const todayCol = page.locator(`[data-droppable-id="${todayIso()}"]`);
  await expect(todayCol.getByText('E2E Sync')).toBeVisible();

  // Mailpit received an ICS invite addressed to the external participant.
  await expect
    .poll(
      async () => {
        const res = await request.get(`${MAILPIT_API}/api/v1/messages`);
        const body = (await res.json()) as { messages: { To: { Address: string }[]; Subject: string }[] };
        return body.messages.some(
          (m) => m.To.some((t) => t.Address === email) && /E2E Sync/.test(m.Subject),
        );
      },
      { timeout: 10_000, message: 'expected an invite email in Mailpit' },
    )
    .toBe(true);

  // Drawer shows the participant.
  await todayCol.getByText('E2E Sync').click();
  await expect(page.getByText(email)).toBeVisible();
});
