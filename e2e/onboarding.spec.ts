import { test, expect } from '@playwright/test';

/**
 * Onboarding overlay E2E tests.
 *
 * The OnboardingOverlay (rendered in app/layout.tsx) checks localStorage
 * for the key "nexus-bio-onboarding-done". If absent, it shows a 3-step
 * walkthrough. These tests use a fresh browser context (no localStorage)
 * to verify the overlay lifecycle.
 */

const STORAGE_KEY = 'nexus-bio-onboarding-done';

/** Wait for client-side hydration to complete (onboarding overlay uses useEffect). */
async function waitForOnboarding(page: import('@playwright/test').Page) {
  // The overlay renders "Welcome" inside a motion.div after useEffect runs.
  // In CI, hydration can be slow, so we wait with a generous timeout.
  await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 15000 });
}

test.describe('Onboarding overlay', () => {
  test('shows on first visit when localStorage is empty', async ({ page }) => {
    await page.goto('/');

    // The overlay should be visible — it contains the eyebrow "Welcome"
    await waitForOnboarding(page);

    // The first step title should be visible
    await expect(
      page.locator('text=Nexus-Bio is a 4-stage research workbench'),
    ).toBeVisible();
  });

  test('clicking Next advances to the second step', async ({ page }) => {
    await page.goto('/');

    // Wait for the overlay to render
    await waitForOnboarding(page);

    // Click the "Next" button
    const nextButton = page.locator('button', { hasText: 'Next' });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Step 2 eyebrow should appear
    await expect(page.locator('text=Start here')).toBeVisible();
    await expect(
      page.locator('text=Browse the tool directory'),
    ).toBeVisible();
  });

  test('clicking Next through all steps shows "Get started" on the last step', async ({
    page,
  }) => {
    await page.goto('/');

    await waitForOnboarding(page);

    // Step 1 -> Step 2
    await page.locator('button', { hasText: 'Next' }).click();
    await expect(page.locator('text=Start here')).toBeVisible();

    // Step 2 -> Step 3
    await page.locator('button', { hasText: 'Next' }).click();
    await expect(page.locator('text=Anytime')).toBeVisible();
    await expect(page.locator('text=Ask Axon for help')).toBeVisible();

    // The last step button should say "Get started" instead of "Next"
    await expect(
      page.locator('button', { hasText: 'Get started' }),
    ).toBeVisible();
  });

  test('clicking "Get started" dismisses the overlay and sets localStorage', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForOnboarding(page);

    // Advance through all 3 steps
    await page.locator('button', { hasText: 'Next' }).click();
    await page.locator('button', { hasText: 'Next' }).click();
    await page.locator('button', { hasText: 'Get started' }).click();

    // Overlay should be dismissed
    await expect(page.locator('text=Welcome')).not.toBeVisible();

    // localStorage should have the done flag
    const value = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
    expect(value).toBe('1');
  });

  test('clicking Skip dismisses the overlay', async ({ page }) => {
    await page.goto('/');

    await waitForOnboarding(page);

    const skipButton = page.locator('button', { hasText: 'Skip' });
    await expect(skipButton).toBeVisible();
    await skipButton.click();

    // Overlay should disappear
    await expect(page.locator('text=Welcome')).not.toBeVisible();
  });

  test('overlay does not show on second visit (localStorage set)', async ({
    page,
    context,
  }) => {
    // Pre-set the localStorage flag before navigating
    await page.goto('/');
    await page.evaluate((key) => localStorage.setItem(key, '1'), STORAGE_KEY);

    // Reload — the overlay should not appear
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Give the page a moment to hydrate, then verify the overlay is absent
    await page.waitForTimeout(1500);
    await expect(page.locator('text=Welcome')).not.toBeVisible();
  });
});
