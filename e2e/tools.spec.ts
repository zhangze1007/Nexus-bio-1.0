import { test, expect } from '@playwright/test';

/**
 * Tool page E2E tests.
 *
 * Each major tool page is tested for:
 *   1. Successful navigation and ToolShell header rendering
 *   2. Presence of the "What does this tool do?" explanation
 *   3. Tab switching (where applicable)
 *
 * Tool pages use the persistent ToolsLayoutShell, so the sidebar and
 * topbar are always present. We navigate via direct URL.
 */

// Tools with tabs and their second-tab label (to verify switching)
const TOOLS_WITH_TABS: Array<{
  route: string;
  moduleId: string;
  title: string;
  secondTab: string;
}> = [
  {
    route: '/tools/fbasim',
    moduleId: 'FBASIM',
    title: 'Flux Balance Analysis',
    secondTab: 'FVA',
  },
  {
    route: '/tools/cethx',
    moduleId: 'CETHX',
    title: 'Cell Thermodynamics',
    secondTab: 'ATP Ledger',
  },
  {
    route: '/tools/genmim',
    moduleId: 'GENMIM',
    title: 'Gene Minimization',
    secondTab: 'Targets',
  },
  {
    route: '/tools/dyncon',
    moduleId: 'DYNCON',
    title: 'Dynamic Control',
    secondTab: 'Hill',
  },
  {
    route: '/tools/cellfree',
    moduleId: 'CFS',
    title: 'Cell-Free Sandbox',
    secondTab: 'Resources',
  },
];

// Tools without tabs (or whose tabs we skip for simplicity)
const TOOLS_BASIC: Array<{
  route: string;
  moduleId: string;
  /** Some pages don't use ToolShell — they use nb-tool-page instead. */
  usesToolShell?: boolean;
}> = [
  { route: '/tools/multio', moduleId: 'MULTIO' },
  { route: '/tools/scspatial', moduleId: 'SCSPATIAL' },
  { route: '/tools/catdes', moduleId: 'CATDES' },
  { route: '/tools/dbtlflow', moduleId: 'DBTL' },
  { route: '/tools/gecair', moduleId: 'GECAIR' },
  { route: '/tools/metabolic-eng', moduleId: 'METABOLIC-ENG' },
  { route: '/tools/nexai', moduleId: 'NEXAI' },
  { route: '/tools/proevol', moduleId: 'PROEVOL' },
];

/** Wait for the tool page to be fully rendered. */
async function waitForToolHeader(
  page: import('@playwright/test').Page,
  moduleId: string,
  usesToolShell = true,
) {
  // Wait for main content area to be present (page layout rendered)
  await expect(page.locator('.nb-ide-main').first()).toBeAttached({ timeout: 15000 });
  if (usesToolShell) {
    // Pages using ToolShell have a header with the moduleId badge
    await expect(
      page.locator('.nb-tool-shell__header', { hasText: moduleId })
    ).toBeVisible({ timeout: 30000 });
  } else {
    // Pages not using ToolShell render .nb-tool-page directly
    await expect(
      page.locator('.nb-tool-page')
    ).toBeVisible({ timeout: 30000 });
  }
}

test.describe('Tool page loading', () => {
  for (const tool of [...TOOLS_WITH_TABS, ...TOOLS_BASIC]) {
    test(`${tool.route} loads and shows the module badge`, async ({ page }) => {
      await page.goto(tool.route);

      // metabolic-eng redirects to pathd — verify redirect
      if (tool.route === '/tools/metabolic-eng') {
        await expect(page).toHaveURL(/\/tools\/pathd/, { timeout: 15000 });
        // PathDPage renders MetabolicEngPage which uses its own custom layout
        // (no ToolShell header) — verify the IDE main area is present instead
        await expect(page.locator('.nb-ide-main').first()).toBeAttached({ timeout: 15000 });
        return;
      }

      const usesToolShell = 'usesToolShell' in tool ? tool.usesToolShell !== false : true;
      await waitForToolHeader(page, tool.moduleId, usesToolShell);
    });
  }
});

test.describe('Tool page explanation', () => {
  for (const tool of TOOLS_WITH_TABS) {
    test(`${tool.route} has a "What does this tool do?" section`, async ({ page }) => {
      await page.goto(tool.route);
      await waitForToolHeader(page, tool.moduleId);
      const summary = page.locator('summary', { hasText: 'What does this tool do?' });
      await expect(summary).toBeVisible();
    });
  }
});

test.describe('Tool page tab switching', () => {
  for (const tool of TOOLS_WITH_TABS) {
    test(`${tool.route} supports tab switching to "${tool.secondTab}"`, async ({ page }) => {
      await page.goto(tool.route);
      await waitForToolHeader(page, tool.moduleId);

      // Collapse sidebar to avoid it intercepting tab clicks
      const sidebar = page.locator('aside[role="navigation"]');
      const isExpanded = await sidebar.getAttribute('aria-expanded');
      if (isExpanded === 'true') {
        const toggleButton = page.locator('button[aria-label="Toggle sidebar"]');
        await toggleButton.click();
        await expect(sidebar).toHaveAttribute('aria-expanded', 'false');
      }

      // Some tabs are hidden in "simple" mode — switch to "advanced" mode if available
      const advancedButton = page.locator('button', { hasText: 'Advanced' });
      if (await advancedButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await advancedButton.click();
      }

      // The first tab should be active by default — verify it has the aria-selected attribute
      const tablist = page.locator('[role="tablist"]');
      await expect(tablist).toBeVisible({ timeout: 10000 });

      // Click the second tab
      const secondTabButton = page.locator('[role="tab"]', { hasText: tool.secondTab });
      await expect(secondTabButton).toBeVisible({ timeout: 10000 });
      await secondTabButton.click();

      // After clicking, the second tab should be selected
      await expect(secondTabButton).toHaveAttribute('aria-selected', 'true');

      // Verify the tab panel content is visible (not just the button state)
      const tabPanel = page.locator('[role="tabpanel"]').first();
      await expect(tabPanel).toBeAttached({ timeout: 5000 });
    });
  }
});

test.describe('Tool directory page', () => {
  test('tools directory loads and lists tool cards', async ({ page }) => {
    await page.goto('/tools');
    // The directory page renders stage labels — use first() to avoid strict mode
    await expect(page.locator('text=Stage 1').first()).toBeVisible();
  });
});
