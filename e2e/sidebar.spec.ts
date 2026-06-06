import { test, expect } from '@playwright/test';

/**
 * Sidebar navigation E2E tests.
 *
 * The IDESidebar is a fixed overlay that:
 *   - Renders on workbench pages (/tools/[id]) but NOT on the directory page (/tools)
 *   - Starts expanded (sidebarCollapsed: false in uiStore)
 *   - Has an aria-expanded attribute on the <aside> element
 *   - Can be toggled via the hamburger button in IDETopBar
 *   - Contains links to all tools grouped by stage
 *
 * The sidebar auto-collapses on route change (ToolsLayoutShell effect),
 * so we test on a single page for most assertions.
 */

test.describe('Sidebar visibility', () => {
  test('sidebar is present on a tool page', async ({ page }) => {
    await page.goto('/tools/fbasim');

    const sidebar = page.locator('aside[role="navigation"][aria-label="Tool navigation"]');
    await expect(sidebar).toBeVisible();
  });

  test('sidebar starts expanded on initial tool page load', async ({ page }) => {
    await page.goto('/tools/fbasim');

    const sidebar = page.locator('aside[role="navigation"]');
    await expect(sidebar).toHaveAttribute('aria-expanded', 'true');
  });

  test('sidebar is not rendered on the tools directory page', async ({ page }) => {
    await page.goto('/tools');

    const sidebar = page.locator('aside[role="navigation"][aria-label="Tool navigation"]');
    await expect(sidebar).not.toBeVisible();
  });
});

test.describe('Sidebar navigation', () => {
  test('clicking a tool link in the sidebar navigates to that tool', async ({
    page,
  }) => {
    await page.goto('/tools/fbasim');

    // The sidebar should be expanded and show tool labels
    const sidebar = page.locator('aside[role="navigation"]');
    await expect(sidebar).toHaveAttribute('aria-expanded', 'true');

    // Find and click the CETHX link in the sidebar
    const cethxLink = sidebar.locator('a', { hasText: 'CETHX' });
    await expect(cethxLink).toBeVisible();
    await cethxLink.click();

    // Should navigate to /tools/cethx
    await expect(page).toHaveURL(/\/tools\/cethx/);

    // The CETHX tool page should load — verify the module badge
    await expect(page.locator('text=CETHX').first()).toBeVisible();
  });

  test('sidebar shows all tool links', async ({ page }) => {
    await page.goto('/tools/pathd');

    const sidebar = page.locator('aside[role="navigation"]');

    // Verify a selection of tool links are present
    const expectedTools = ['PATHD', 'FBASIM', 'CETHX', 'GENMIM', 'DYNCON'];
    for (const label of expectedTools) {
      await expect(sidebar.locator(`text=${label}`).first()).toBeVisible();
    }
  });
});

test.describe('Sidebar collapse/expand toggle', () => {
  test('toggling the sidebar via the hamburger button collapses it', async ({
    page,
  }) => {
    await page.goto('/tools/fbasim');

    const sidebar = page.locator('aside[role="navigation"]');
    await expect(sidebar).toHaveAttribute('aria-expanded', 'true');

    // The hamburger toggle button is in IDETopBar
    const toggleButton = page.locator('button[aria-label="Toggle sidebar"]');
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();

    // Sidebar should now be collapsed
    await expect(sidebar).toHaveAttribute('aria-expanded', 'false');
  });

  test('toggling collapsed sidebar re-expands it', async ({ page }) => {
    await page.goto('/tools/fbasim');

    const sidebar = page.locator('aside[role="navigation"]');
    const toggleButton = page.locator('button[aria-label="Toggle sidebar"]');

    // Collapse
    await toggleButton.click();
    await expect(sidebar).toHaveAttribute('aria-expanded', 'false');

    // Re-expand
    await toggleButton.click();
    await expect(sidebar).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('TopBar breadcrumb', () => {
  test('topbar shows Home > Tools breadcrumb on a tool page', async ({ page }) => {
    await page.goto('/tools/fbasim');

    // The topbar contains Home and Tools links
    const topbar = page.locator('header.nb-ide-topbar');
    await expect(topbar.locator('text=Home')).toBeVisible();
    await expect(topbar.locator('text=Tools')).toBeVisible();
  });

  test('topbar shows the tool short label for a specific tool', async ({ page }) => {
    await page.goto('/tools/cethx');

    // The breadcrumb should include the module short label
    const topbar = page.locator('header.nb-ide-topbar');
    await expect(topbar.locator('text=CETHX')).toBeVisible();
  });
});
