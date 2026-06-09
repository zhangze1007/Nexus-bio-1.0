import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1').first()).toBeVisible();
});

test('navigate to tools directory', async ({ page }) => {
  await page.goto('/tools');
  await expect(page.locator('text=Pathway & Enzyme Design')).toBeVisible();
});
