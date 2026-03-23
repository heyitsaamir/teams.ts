// Auto-generated from e2e.spec.md — do not edit manually
import { test as base, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import { readdirSync } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Find the playwright-cli persistent profile directory for the "teams" session.
 * playwright-cli stores profiles at:
 *   ~/Library/Caches/ms-playwright/daemon/<hash>/ud-teams-msedge  (macOS)
 * We scan for the ud-teams-msedge directory.
 * Override with E2E_PROFILE_DIR env var.
 */
function getProfileDir(): string {
  if (process.env.E2E_PROFILE_DIR) return process.env.E2E_PROFILE_DIR;

  const daemonDir = path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright', 'daemon');
  try {
    for (const hash of readdirSync(daemonDir)) {
      const candidate = path.join(daemonDir, hash, 'ud-teams-msedge');
      try {
        readdirSync(candidate);
        return candidate;
      } catch { /* not this hash */ }
    }
  } catch { /* daemon dir doesn't exist */ }

  // Fallback: local profile (will need headed auth on first run)
  return path.join(__dirname, '..', '..', '.browser-profile');
}

const userDataDir = getProfileDir();

// Shared browser context — launched once per worker, reused across all tests.
let sharedContext: BrowserContext | null = null;
let sharedPage: Page | null = null;

async function getSharedPage(): Promise<Page> {
  if (sharedContext && sharedPage) return sharedPage;

  const headed = process.env.E2E_HEADED === '1';

  sharedContext = await chromium.launchPersistentContext(userDataDir, {
    channel: 'msedge',
    headless: !headed,
    viewport: { width: 1280, height: 720 },
  });

  sharedPage = sharedContext.pages()[0] || await sharedContext.newPage();

  // Navigate directly to Teams chat view
  await sharedPage.goto('https://teams.cloud.microsoft/v2/#/conversations');
  await sharedPage.waitForLoadState('domcontentloaded');

  // Handle Teams crash page — if main content crashed, reload
  const crashHeading = sharedPage.getByRole('heading', { name: /run into an issue|couldn't sign you in/i });
  if (await crashHeading.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await sharedPage.reload();
    await sharedPage.waitForLoadState('domcontentloaded');
  }

  // Wait for Teams to load — look for compose box or Chat nav button
  const teamsLoaded = sharedPage
    .getByRole('textbox', { name: 'Type a message' })
    .or(sharedPage.getByRole('button', { name: /^Chat/ }));

  await expect(teamsLoaded.first()).toBeVisible({ timeout: 30_000 });

  return sharedPage;
}

/**
 * Custom fixture that provides a Teams page with persistent auth context.
 * Reuses the same browser context across all tests in a worker to avoid
 * profile corruption from rapid open/close cycles.
 */
export const test = base.extend<{ teamsPage: Page }>({
  teamsPage: async ({}, use) => {
    const page = await getSharedPage();
    await use(page);
    // Don't close context — reuse for next test
  },
});

// Close the shared context when the worker exits
process.on('beforeExit', async () => {
  if (sharedContext) {
    await sharedContext.close().catch(() => {});
    sharedContext = null;
    sharedPage = null;
  }
});

export { expect };

/**
 * Send a message in the Teams chat compose box and wait for a bot response.
 */
export async function sendAndExpect(
  page: Page,
  message: string,
  expectedText: string | RegExp,
  timeout = 10_000
): Promise<void> {
  const compose = page.getByRole('textbox', { name: 'Type a message' });
  await compose.click();
  await compose.fill(message);
  await page.keyboard.press('Enter');

  const responseLocator =
    typeof expectedText === 'string'
      ? page.getByText(expectedText).last()
      : page.locator(`text=${expectedText.source}`).last();

  await expect(responseLocator).toBeVisible({ timeout });
}
