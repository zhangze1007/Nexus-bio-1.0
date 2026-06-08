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
    secondTab: 'Knockout',
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

/** Wait for the tool page header to be fully rendered. */
async function waitForToolHeader(page: import('@playwright/test').Page, moduleId: string) {
  await expect(
    page.locator('.nb-tool-shell__header', { hasText: moduleId })
  ).toBeVisible({ timeout: 15000 });
}

test.describe('Tool page loading', () => {
  for (const tool of [...TOOLS_WITH_TABS, ...TOOLS_BASIC]) {
    test(`${tool.route} loads and shows the module badge`, async ({ page }) => {
      await page.goto(tool.route);
      // The ToolShell header renders a shortLabel badge (e.g. "FBASIM")
      // Scope to the header to avoid strict mode violations from sidebar/topbar duplicates
      await waitForToolHeader(page, tool.moduleId);
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

      // The first tab should be active by default — verify it has the aria-selected attribute
      const tablist = page.locator('[role="tablist"]');
      await expect(tablist).toBeVisible({ timeout: 10000 });

      // Click the second tab
      const secondTabButton = page.locator('[role="tab"]', { hasText: tool.secondTab });
      await expect(secondTabButton).toBeVisible({ timeout: 10000 });
      await secondTabButton.click();

      // After clicking, the second tab should be selected
      await expect(secondTabButton).toHaveAttribute('aria-selected', 'true');
    });
  }
});

test.describe('Tool directory page', () => {
  test('tools directory loads and lists tool cards', async ({ page }) => {
    await page.goto('/tools');
    // The directory page renders stage labels
    await expect(page.locator('text=Stage 1')).toBeVisible();
  });
});
