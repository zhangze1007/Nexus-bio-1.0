import { chromium, type FullConfig } from '@playwright/test';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Global setup — seeds localStorage so the onboarding overlay is skipped.
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

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';

  // Ensure the .auth directory exists (it's gitignored)
  mkdirSync(dirname(STORAGE_PATH), { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });

    // Seed localStorage to dismiss the onboarding overlay
    await page.evaluate(
      (key: string) => localStorage.setItem(key, '1'),
      STORAGE_KEY,
    );

    // Persist the storage state (cookies + localStorage) for all tests
    await context.storageState({ path: STORAGE_PATH });
  } finally {
    await browser.close();
  }
}

export default globalSetup;
