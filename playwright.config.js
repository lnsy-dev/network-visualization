/**
 * Playwright Configuration
 *
 * End-to-end test configuration for the network-visualization project.
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * Load environment variables from .env so the test runner uses the same
 * PORT and other settings as the webpack dev server.
 */
dotenv.config();

const devPort = Number(process.env.PORT) || 3000;
const devBaseUrl = `http://localhost:${devPort}`;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  /**
   * Directory containing test files.
   */
  testDir: './tests',

  /**
   * Unit tests (Vitest) live alongside the Playwright specs — exclude
   * them so Playwright never tries to run them.
   */
  testIgnore: '**/unit/**',

  /**
   * Run tests in files in parallel.
   */
  fullyParallel: true,

  /**
   * Fail the build on CI if you accidentally left test.only in the source code.
   */
  forbidOnly: !!process.env.CI,

  /**
   * Retry on CI only to reduce flake from infrastructure noise.
   */
  retries: process.env.CI ? 2 : 0,

  /**
   * Opt out of parallel tests on CI for stability.
   */
  workers: process.env.CI ? 1 : undefined,

  /**
   * Reporter to use. 'html' generates a browsable report in playwright-report/.
   */
  reporter: 'html',

  /**
   * Shared settings for all projects.
   */
  use: {
    /**
     * Base URL to use in actions like page.goto('/').
     */
    baseURL: devBaseUrl,

    /**
     * Collect trace when retrying the failed test.
     */
    trace: 'on-first-retry',

    /**
     * Capture screenshots on failure for debugging.
     */
    screenshot: 'only-on-failure',
  },

  /**
   * Test projects: define different browsers and environments.
   */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * Local dev server configuration.
   */
  webServer: {
    command: 'npm start',
    url: devBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
