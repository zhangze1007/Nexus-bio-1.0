import { test, expect } from '@playwright/test';

/**
 * Search bar E2E tests.
 *
 * The Hero component renders a research search bar on the homepage.
 * On Enter it navigates to /research?q=<encoded query>.
 */

test.describe('Homepage search bar', () => {
  test('search input is visible on the homepage', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[aria-label="Search research database"]');
    await expect(input).toBeVisible();
  });

  test('search input accepts typed text', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[aria-label="Search research database"]');
    await input.fill('artemisinin biosynthesis');
    await expect(input).toHaveValue('artemisinin biosynthesis');
  });

  test('pressing Enter navigates to /research with query parameter', async ({
    page,
  }) => {
    await page.goto('/');
    const input = page.locator('input[aria-label="Search research database"]');
    await expect(input).toBeVisible({ timeout: 10000 });
    // Use type instead of fill to properly trigger React's onChange handler
    await input.click();
    await input.type('metabolic engineering', { delay: 10 });
    // Small wait to ensure React has processed the state update
    await page.waitForTimeout(200);
    await input.press('Enter');

    // Should navigate to /research?q=metabolic%20engineering
    await page.waitForURL(/\/research\?q=/, { timeout: 15000 });
    const url = new URL(page.url());
    expect(url.pathname).toBe('/research');
    expect(url.searchParams.get('q')).toBe('metabolic engineering');
  });

  test('search input has proper aria-label for accessibility', async ({
    page,
  }) => {
    await page.goto('/');
    const input = page.locator('input[aria-label="Search research database"]');
    await expect(input).toHaveAttribute('aria-label', 'Search research database');
  });

  test('search input has aria-autocomplete attribute', async ({ page }) => {
    await page.goto('/');
    const input = page.locator('input[aria-label="Search research database"]');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });
});
