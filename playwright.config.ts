import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL || 'http://localhost:5000';
const useExternalBaseUrl = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/dist/**'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: process.env.CI || useExternalBaseUrl ? undefined : {
    command: 'npm run dev',
    url: `${baseURL}/api/health`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
