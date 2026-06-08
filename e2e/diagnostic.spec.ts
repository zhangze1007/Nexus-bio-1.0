import { test, expect } from '@playwright/test';

/**
 * Diagnostic test — captures what's actually happening on tool pages.
 * Run this to understand why .nb-tool-shell__header is not found.
 */

test('diagnostic: /tools/fbasim page state after 30s', async ({ page }) => {
  const consoleMessages: string[] = [];
  const consoleErrors: string[] = [];

  // Capture all console output
  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    consoleMessages.push(text);
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Capture page errors (uncaught exceptions)
  page.on('pageerror', (error) => {
    consoleErrors.push(`PAGE ERROR: ${error.message}`);
  });

  // Capture failed requests
  const failedRequests: string[] = [];
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} - ${request.failure()?.errorText}`);
  });

  console.log('=== Navigating to /tools/fbasim ===');
  await page.goto('/tools/fbasim');

  // Wait a bit for initial load
  await page.waitForTimeout(5000);

  // Check what's in the DOM
  const bodyHTML = await page.evaluate(() => {
    const body = document.body;
    return {
      childCount: body.children.length,
      // Check for key elements
      hasIdeShell: !!document.querySelector('.nb-ide-shell'),
      hasIdeMain: !!document.querySelector('.nb-ide-main'),
      hasToolShell: !!document.querySelector('.nb-tool-shell'),
      hasToolShellHeader: !!document.querySelector('.nb-tool-shell__header'),
      hasOnboardingOverlay: !!document.querySelector('[style*="z-index: 9999"]'),
      // Get all class names on direct children of main
      mainChildren: Array.from(document.querySelector('.nb-ide-main')?.children || []).map(el => ({
        tag: el.tagName,
        class: el.className?.substring?.(0, 80) || '',
        childCount: el.children.length,
      })),
      // Check for loading spinners
      spinners: document.querySelectorAll('[style*="animation: spin"]').length,
      // Check for error boundaries
      errorBoundaries: document.querySelectorAll('[class*="error"]').length,
    };
  });

  console.log('=== DOM State after 5s ===');
  console.log(JSON.stringify(bodyHTML, null, 2));

  // Wait more
  await page.waitForTimeout(10000);

  const bodyHTML2 = await page.evaluate(() => {
    return {
      hasToolShell: !!document.querySelector('.nb-tool-shell'),
      hasToolShellHeader: !!document.querySelector('.nb-tool-shell__header'),
      hasOnboardingOverlay: !!document.querySelector('[style*="z-index: 9999"]'),
      // Get the full HTML of nb-ide-main
      ideMainHTML: document.querySelector('.nb-ide-main')?.innerHTML?.substring(0, 2000) || 'NOT FOUND',
    };
  });

  console.log('=== DOM State after 15s ===');
  console.log(JSON.stringify(bodyHTML2, null, 2));

  // Final check after 30s total
  await page.waitForTimeout(15000);

  const bodyHTML3 = await page.evaluate(() => {
    return {
      hasToolShell: !!document.querySelector('.nb-tool-shell'),
      hasToolShellHeader: !!document.querySelector('.nb-tool-shell__header'),
      hasOnboardingOverlay: !!document.querySelector('[style*="z-index: 9999"]'),
      ideMainHTML: document.querySelector('.nb-ide-main')?.innerHTML?.substring(0, 2000) || 'NOT FOUND',
    };
  });

  console.log('=== DOM State after 30s ===');
  console.log(JSON.stringify(bodyHTML3, null, 2));

  console.log('=== Console Errors ===');
  consoleErrors.forEach(e => console.log(`  ERROR: ${e}`));

  console.log('=== Failed Requests ===');
  failedRequests.forEach(r => console.log(`  FAILED: ${r}`));

  console.log('=== All Console Messages ===');
  consoleMessages.forEach(m => console.log(`  ${m}`));

  // The test always passes — we just want the diagnostic output
  expect(true).toBe(true);
});
