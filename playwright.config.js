import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node server.js',
      url: 'http://127.0.0.1:5000/api/violet/products',
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        PORT: '5000',
        MONGO: process.env.MONGO_TEST || 'mongodb://127.0.0.1:27017/violet_e2e',
        jwtSecret: process.env.jwtSecret || 'e2e_test_secret',
        RESET_DEV_MODE: 'true',
        BUCKET_NAME: process.env.BUCKET_NAME || 'violet-products',
        BUCKET_REGION: 'us-east-1',
        ACCESS_KEY: 'minioadmin',
        SECRET_ACCESS_KEY: 'minioadmin',
        S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://127.0.0.1:9000',
      },
    },
    {
      command: 'npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
