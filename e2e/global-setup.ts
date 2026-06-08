import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Global setup — seeds localStorage so the onboarding overlay is skipped,
 * AND warms up the dev server by visiting all tool pages to trigger
 * lazy compilation of their JavaScript chunks.
 *
 * The OnboardingOverlay checks for "nexus-bio-onboarding-done" in
 * localStorage. By navigating to the homepage once and setting that key
 * before the test suite runs, all tests start without the overlay.
 *
 * The resulting storage state is written to e2e/.auth/storage-state.json
 * and referenced from playwright.config.ts via `storageState`.
 */
const STORAGE_KEY = 'nexus-bio-onboarding-done';
const STORAGE_PATH = './e2e/.auth/storage-state.json';

/** All tool page routes — visiting these triggers dev server chunk compilation. */
const TOOL_ROUTES = [
  '/tools/pathd',
  '/tools/metabolic-eng',
  '/tools/catdes',
  '/tools/cellfree',
  '/tools/cethx',
  '/tools/dbtlflow',
  '/tools/dyncon',
  '/tools/fbasim',
  '/tools/gecair',
  '/tools/genmim',
  '/tools/multio',
  '/tools/nexai',
  '/tools/proevol',
  '/tools/scspatial',
];

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';

  // Ensure the .auth directory exists (it's gitignored)
  mkdirSync(dirname(STORAGE_PATH), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Seed localStorage to dismiss the onboarding overlay
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (key: string) => localStorage.setItem(key, '1'),
      STORAGE_KEY,
    );

    // Step 2: Warm up dev server — visit each tool page to trigger chunk compilation.
    // This prevents 20+ second delays when tests first navigate to tool pages.
    // Use domcontentloaded (not load) to avoid waiting for all resources.
    console.log('[global-setup] Warming up dev server — visiting tool pages...');
    for (const route of TOOL_ROUTES) {
      try {
        await page.goto(`${baseURL}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 30000,
        });
        // Brief pause to let the dev server start compilation
        await page.waitForTimeout(500);
      } catch (err) {
        // Don't fail setup if a single page times out
        console.warn(`[global-setup] Warmup failed for ${route}: ${err}`);
      }
    }
    console.log('[global-setup] Warmup complete.');

    // Step 3: Persist the storage state (cookies + localStorage) for all tests
    await context.storageState({ path: STORAGE_PATH });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
