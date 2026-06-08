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
 *
 * NOTE: The sidebar uses Framer Motion spring animation for its width
 * and layout transitions. Playwright's toBeVisible() may report "hidden"
 * during animation. We use toBeAttached() + attribute checks instead.
 */

/** Wait for the page and sidebar to be ready for interaction. */
async function waitForPageReady(page: import('@playwright/test').Page) {
  // Wait for the main content to render (indicates page is hydrated)
  await page.waitForLoadState('domcontentloaded');
  // Wait for the sidebar to be in the DOM with correct state
  const sidebar = page.locator('aside[role="navigation"][aria-label="Tool navigation"]');
  await expect(sidebar).toBeAttached({ timeout: 15000 });
  await expect(sidebar).toHaveAttribute('aria-expanded', 'true', { timeout: 15000 });
}

test.describe('Sidebar visibility', () => {
  test('sidebar is present on a tool page', async ({ page }) => {
    await page.goto('/tools/fbasim');
    await waitForPageReady(page);

    const sidebar = page.locator('aside[role="navigation"][aria-label="Tool navigation"]');
    await expect(sidebar).toBeAttached();
    await expect(sidebar).toHaveAttribute('aria-expanded', 'true');
  });

  test('sidebar starts expanded on initial tool page load', async ({ page }) => {
    await page.goto('/tools/fbasim');
    await waitForPageReady(page);

    const sidebar = page.locator('aside[role="navigation"]');
    await expect(sidebar).toHaveAttribute('aria-expanded', 'true');
  });

  test('sidebar is not rendered on the tools directory page', async ({ page }) => {
    await page.goto('/tools');

    const sidebar = page.locator('aside[role="navigation"][aria-label="Tool navigation"]');
    await expect(sidebar).not.toBeAttached();
  });
});

test.describe('Sidebar navigation', () => {
  test('clicking a tool link in the sidebar navigates to that tool', async ({
    page,
  }) => {
    await page.goto('/tools/fbasim');
    await waitForPageReady(page);

    const sidebar = page.locator('aside[role="navigation"]');

    // Find and click the CETHX link in the sidebar
    const cethxLink = sidebar.locator('a', { hasText: 'CETHX' });
    await expect(cethxLink).toBeAttached();
    await cethxLink.click();

    // Should navigate to /tools/cethx
    await expect(page).toHaveURL(/\/tools\/cethx/);
  });

  test('sidebar shows all tool links', async ({ page }) => {
    await page.goto('/tools/pathd');
    await waitForPageReady(page);

    const sidebar = page.locator('aside[role="navigation"]');

    // Verify a selection of tool links are present
    const expectedTools = ['PATHD', 'FBASIM', 'CETHX', 'GENMIM', 'DYNCON'];
    for (const label of expectedTools) {
      await expect(sidebar.locator(`text=${label}`).first()).toBeAttached();
    }
  });
});

test.describe('Sidebar collapse/expand toggle', () => {
  test('toggling the sidebar via the hamburger button collapses it', async ({
    page,
  }) => {
    await page.goto('/tools/fbasim');
    await waitForPageReady(page);

    const sidebar = page.locator('aside[role="navigation"]');
    await expect(sidebar).toHaveAttribute('aria-expanded', 'true');

    // The hamburger toggle button is in IDETopBar
    const toggleButton = page.locator('button[aria-label="Toggle sidebar"]');
    await expect(toggleButton).toBeAttached();
    await toggleButton.click();

    // Sidebar should now be collapsed
    await expect(sidebar).toHaveAttribute('aria-expanded', 'false');
  });

  test('toggling collapsed sidebar re-expands it', async ({ page }) => {
    await page.goto('/tools/fbasim');
    await waitForPageReady(page);

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
    await waitForPageReady(page);

    // The topbar contains Home and Workbench (link to /tools) links
    const topbar = page.locator('header.nb-ide-topbar');
    await expect(topbar.locator('text=Home')).toBeAttached();
    await expect(topbar.locator('text=Workbench')).toBeAttached();
  });

  test('topbar shows the tool short label for a specific tool', async ({ page }) => {
    await page.goto('/tools/cethx');
    await waitForPageReady(page);

    // The breadcrumb should include the module short label
    const topbar = page.locator('header.nb-ide-topbar');
    await expect(topbar.locator('text=CETHX')).toBeAttached();
  });
});
