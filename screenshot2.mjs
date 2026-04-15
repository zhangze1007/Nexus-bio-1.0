import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });

await page.goto('http://localhost:3000/tools/catdes', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(4000);

// Click the Analysis tab
const analysisTab = page.locator('button', { hasText: 'Analysis' });
if (await analysisTab.count() > 0) {
  await analysisTab.click();
  await page.waitForTimeout(2000);
}

// Full page screenshot at high resolution
await page.screenshot({ path: '/home/user/catdes-full.png', fullPage: false });

// Try to screenshot just the inspector/sidebar panel
const inspector = page.locator('div').filter({ has: page.locator('text=ACTIVE-SITE DIAGNOSTICS') }).first();
if (await inspector.count() > 0) {
  await inspector.screenshot({ path: '/home/user/catdes-chart-zoom.png' });
  console.log('Zoomed chart screenshot saved');
} else {
  console.log('Could not find chart element, saving full page only');
}

console.log('Full screenshot saved to /home/user/catdes-full.png');
await browser.close();
