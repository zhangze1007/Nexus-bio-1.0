import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E config.
 *
 * Two modes:
 *   CI (default):    `npm run dev` (Next.js dev server, lazy compilation)
 *   Local prod:      `npm run build && npx next start` (production server, less memory)
 *
 * To run E2E tests locally with production build:
 *   npm run build && E2E_PROD=1 npx playwright test
 */
const useProdServer = !!process.env.E2E_PROD;

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    storageState: './e2e/.auth/storage-state.json',
    launchOptions: {
      args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: useProdServer ? 'npx next start -p 3000' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: useProdServer ? 30000 : 120000,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'local-dev-secret',
      NEXUS_API_KEY: process.env.NEXUS_API_KEY ?? 'e2e-test-key',
    },
  },
});
