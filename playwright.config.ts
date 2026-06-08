import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    storageState: './e2e/.auth/storage-state.json',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'local-dev-secret',
      NEXUS_API_KEY: process.env.NEXUS_API_KEY ?? 'e2e-test-key',
    },
  },
});
