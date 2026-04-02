import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: 'http://localhost:8085',
    trace: 'on-first-retry',
    // Capture console errors automatically
    ignoreHTTPSErrors: false,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Serve the pre-generated dist/ directory.
  // Run `npm run build` before running e2e tests locally.
  webServer: {
    command: 'npx serve dist -p 8085 --no-clipboard',
    url: 'http://localhost:8085',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
