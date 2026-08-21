/**
 * Vitest Configuration
 *
 * Unit test configuration for the network-visualization project.
 *
 * Vitest runs the fast, DOM-free unit tests in tests/unit/.
 * It is deliberately scoped to that directory so it never picks up the
 * Playwright specs under tests/e2e/.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /**
     * Only run unit tests — never Playwright specs.
     */
    include: ['tests/unit/**/*.test.js'],

    /**
     * Pure-logic tests need no DOM.
     */
    environment: 'node',
  },
});
