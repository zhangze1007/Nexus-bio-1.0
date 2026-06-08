import { test, expect } from '@playwright/test';

/**
 * 404 page E2E tests.
 *
 * Next.js renders app/not-found.tsx for unmatched routes.
 * The page displays "404 — Page Not Found" and a "Go home" link.
 */

test.describe('404 page', () => {
  test('navigating to an unknown route shows the 404 page', async ({
    page,
  }) => {
    const response = await page.goto('/nonexistent-page');

    // Next.js returns 404 status for not-found pages
    expect(response?.status()).toBe(404);

    // The not-found page renders a heading with "404"
    await expect(page.locator('h2')).toBeVisible();
    await expect(page.locator('text=404')).toBeVisible();
  });

  test('404 page shows a "Go home" link', async ({ page }) => {
    await page.goto('/nonexistent-page');
    const homeLink = page.locator('a', { hasText: 'Go home' });
    await expect(homeLink).toBeVisible();
    await expect(homeLink).toHaveAttribute('href', '/');
  });
});
