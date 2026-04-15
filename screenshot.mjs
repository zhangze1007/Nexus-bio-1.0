import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto('http://localhost:3000/tools/catdes', { waitUntil: 'networkidle', timeout: 30000 });

// Wait for page to fully render
await page.waitForTimeout(3000);

// Click the Analysis tab
const analysisTab = page.locator('button', { hasText: 'Analysis' });
if (await analysisTab.count() > 0) {
  await analysisTab.click();
  await page.waitForTimeout(2000);
}

// Take full page screenshot
await page.screenshot({ path: '/home/user/catdes-binding-chart.png', fullPage: false });
console.log('Screenshot saved to /home/user/catdes-binding-chart.png');

await browser.close();
