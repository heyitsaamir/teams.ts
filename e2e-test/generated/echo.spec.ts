// Auto-generated from e2e.spec.md — do not edit manually
import { test, expect, sendAndExpect } from './helpers/teams-fixture';

test.describe('Echo Bot', () => {
  test('echoes "Hello world"', async ({ teamsPage: page }) => {
    await sendAndExpect(page, 'Hello world', 'you said "Hello world"');
  });

  test('echoes "Testing 123"', async ({ teamsPage: page }) => {
    await sendAndExpect(page, 'Testing 123', 'you said "Testing 123"');
  });
});
