// Auto-generated from e2e.spec.md — do not edit manually
import { test, expect, sendAndExpect } from './helpers/teams-fixture';

test.describe('Reactions Bot', () => {
  test('echoes "hello"', async ({ teamsPage: page }) => {
    await sendAndExpect(page, 'hello', 'You said: "hello"');
  });

  test('add like reaction', async ({ teamsPage: page }) => {
    await sendAndExpect(page, 'add like', 'Added a like reaction to your message!');
  });

  test('remove like reaction', async ({ teamsPage: page }) => {
    await sendAndExpect(page, 'remove like', 'Removed the like reaction from the last reacted message!');
  });
});
