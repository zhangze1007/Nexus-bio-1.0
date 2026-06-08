import { test, expect } from '@playwright/test';

/**
 * Diagnostic test — captures what's actually happening on tool pages.
 * Run this to understand why .nb-tool-shell__header is not found.
 */

test('diagnostic: /tools/fbasim page state', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    consoleErrors.push(`PAGE_ERROR: ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} - ${request.failure()?.errorText}`);
  });

  console.log('=== Navigating to /tools/fbasim ===');
  await page.goto('/tools/fbasim');

  // Check at 5s
  await page.waitForTimeout(5000);

  const state5s = await page.evaluate(() => {
    const mainEl = document.querySelector('.nb-ide-main');
    const wbContent = mainEl?.querySelector('.nb-workbench-content');

    return {
      hasIdeShell: !!document.querySelector('.nb-ide-shell'),
      hasIdeMain: !!mainEl,
      hasToolShell: !!document.querySelector('.nb-tool-shell'),
      hasToolShellHeader: !!document.querySelector('.nb-tool-shell__header'),
      // Check ErrorBoundary fallback specifically
      hasAlertRole: !!document.querySelector('[role="alert"]'),
      hasSomethingWrong: document.body.innerText.includes('Something went wrong'),
      // Check for any dynamic import loading states
      hasSpinners: document.querySelectorAll('[style*="animation: spin"]').length,
      // Count nb-workbench-content children
      wbContentChildCount: wbContent?.children.length ?? 0,
      // List all direct children of nb-workbench-content
      wbContentChildren: Array.from(wbContent?.children || []).map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        class: (el.className || '').substring(0, 60),
        text: el.textContent?.substring(0, 100) || '',
      })),
      // Full innerHTML of nb-workbench-content (truncated)
      wbContentHTML: wbContent?.innerHTML?.substring(0, 3000) || 'NOT FOUND',
    };
  });

  console.log('=== STATE at 5s ===');
  console.log(JSON.stringify(state5s, null, 2));

  // Check at 15s
  await page.waitForTimeout(10000);

  const state15s = await page.evaluate(() => {
    const mainEl = document.querySelector('.nb-ide-main');
    const wbContent = mainEl?.querySelector('.nb-workbench-content');

    return {
      hasToolShell: !!document.querySelector('.nb-tool-shell'),
      hasToolShellHeader: !!document.querySelector('.nb-tool-shell__header'),
      hasAlertRole: !!document.querySelector('[role="alert"]'),
      hasSomethingWrong: document.body.innerText.includes('Something went wrong'),
      hasSpinners: document.querySelectorAll('[style*="animation: spin"]').length,
      wbContentChildCount: wbContent?.children.length ?? 0,
      wbContentChildren: Array.from(wbContent?.children || []).map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        class: (el.className || '').substring(0, 60),
        text: el.textContent?.substring(0, 100) || '',
      })),
    };
  });

  console.log('=== STATE at 15s ===');
  console.log(JSON.stringify(state15s, null, 2));

  console.log('=== Console Errors ===');
  consoleErrors.forEach(e => console.log(`  ERROR: ${e}`));
  if (consoleErrors.length === 0) console.log('  (none)');

  console.log('=== Failed Requests ===');
  failedRequests.forEach(r => console.log(`  FAILED: ${r}`));
  if (failedRequests.length === 0) console.log('  (none)');

  expect(true).toBe(true);
});
