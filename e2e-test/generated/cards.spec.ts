// Auto-generated from e2e.spec.md — do not edit manually
import { test, expect, sendAndExpect } from './helpers/teams-fixture';

test.describe('Cards Bot', () => {
  test.beforeEach(async ({ teamsPage: page }) => {
    // Ensure we're in the correct bot chat — navigate to it if compose box isn't visible
    const compose = page.getByRole('textbox', { name: 'Type a message' });
    if (!await compose.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await page.getByRole('treeitem', { name: /tab-tester/i }).first().click();
      await expect(compose).toBeVisible({ timeout: 10_000 });
    }
  });

  test('help / usage card on unrecognized command', async ({ teamsPage: page }) => {
    // Send any unrecognized command to get the help card
    const compose = page.getByRole('textbox', { name: 'Type a message' });
    await compose.click();
    await compose.fill('hello');
    await page.keyboard.press('Enter');

    // Bot responds with an adaptive card listing available commands
    await expect(page.getByText('Available commands:').last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('!basic').last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('!form').last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('!json').last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('!actions').last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('!profile').last()).toBeVisible({ timeout: 5_000 });
  });

  test('basic card with toggle', async ({ teamsPage: page }) => {
    await sendAndExpect(page, '!basic', 'Hello world');
    // Verify the toggle input is present
    await expect(page.getByText('Notify me').last()).toBeVisible({ timeout: 5_000 });
    // Verify the Submit button is present
    await expect(page.getByRole('button', { name: 'Submit' }).last()).toBeVisible({ timeout: 5_000 });
  });

  test('submit basic card with toggle', async ({ teamsPage: page }) => {
    // Check the "Notify me" toggle on the last basic card
    await page.getByText('Notify me').last().click();
    // Click Submit
    await page.getByRole('button', { name: 'Submit' }).last().click();
    // Bot responds with notification preference confirmation
    await expect(page.getByText('Notification preference set to').last()).toBeVisible({ timeout: 10_000 });
  });

  test('form card', async ({ teamsPage: page }) => {
    await sendAndExpect(page, '!form', 'Please fill out the below form:');
    // Verify form fields are present using textbox role to avoid matching message text
    await expect(page.getByRole('textbox', { name: 'Name' }).last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('textbox', { name: 'Comments' }).last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Favorite Color').last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Submit Form' }).last()).toBeVisible({ timeout: 5_000 });
  });

  test('submit form card', async ({ teamsPage: page }) => {
    // Fill in the form fields on the last form card using textbox role
    await page.getByRole('textbox', { name: 'Name' }).last().fill('Test User');
    await page.getByRole('textbox', { name: 'Comments' }).last().fill('Great bot');
    // Leave Favorite Color as default (blue)
    // Click Submit Form
    await page.getByRole('button', { name: 'Submit Form' }).last().click();
    // Bot responds with form submission confirmation
    await expect(page.getByText('Form submitted!').last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Name: Test User').last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Color: blue').last()).toBeVisible({ timeout: 5_000 });
  });

  test('profile card', async ({ teamsPage: page }) => {
    await sendAndExpect(page, '!profile', 'Subscribe to newsletter');
    // Verify pre-filled fields using textbox role
    await expect(page.getByRole('textbox', { name: 'Name' }).last()).toHaveValue('John Doe', { timeout: 5_000 });
    await expect(page.getByRole('textbox', { name: 'Email' }).last()).toHaveValue('john@contoso.com', { timeout: 5_000 });
    await expect(page.getByRole('button', { name: 'Save' }).last()).toBeVisible({ timeout: 5_000 });
  });

  test('submit profile card', async ({ teamsPage: page }) => {
    // Click Save with pre-filled values
    await page.getByRole('button', { name: 'Save' }).last().click();
    // Bot responds with profile save confirmation
    await expect(page.getByText('Profile saved!').last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Name: John Doe').last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Email: john@contoso.com').last()).toBeVisible({ timeout: 5_000 });
  });
});
