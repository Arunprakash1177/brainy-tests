import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.TEST_PORT || '3100';
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1, // shared server state; tests create uniquely named data
  retries: CI ? 2 : 0,
  forbidOnly: CI,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Starts the app automatically unless you point BASE_URL at a running one.
  // DATABASE_URL is blanked on purpose so tests never touch a real database:
  // the app then uses its built-in in-memory store with seeded accounts.
  // To test against Postgres, set TEST_DATABASE_URL (a throwaway DB, already
  // pushed and seeded).
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: !CI,
        timeout: 180_000,
        env: {
          PORT,
          NODE_ENV: 'development',
          JWT_SECRET: 'test-secret-not-for-production',
          DATABASE_URL: process.env.TEST_DATABASE_URL || '',
          REDIS_URL: '',
        },
      },

  projects: [
    { name: 'api', testDir: './tests/api' },
    { name: 'e2e-desktop', testDir: './tests/e2e', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'e2e-mobile',
      testDir: './tests/e2e',
      testMatch: /login\.spec\.ts/, // sidebar is a drawer on mobile; crawl runs on desktop
      use: { ...devices['Pixel 7'] },
    },
  ],
});
