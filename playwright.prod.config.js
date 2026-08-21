/**
 * Playwright Production Configuration
 *
 * End-to-end test configuration that runs specs against the production
 * build served from the dist/ directory.
 */

import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

/**
 * Load environment variables from .env so the production test server uses
 * the same PORT offset as the development configuration.
 */
dotenv.config();

const devPort = Number(process.env.PORT) || 3000;
const prodPort = Number(process.env.PROD_PORT) || devPort + 1;
const prodBaseUrl = `http://localhost:${prodPort}`;

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  /**
   * Directory containing test files.
   */
  testDir: './tests/e2e',

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
    baseURL: prodBaseUrl,

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
      name: 'production',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * Static server for production build tests.
   */
  webServer: {
    command: `npm run build && npx serve dist -l ${prodPort}`,
    url: prodBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
