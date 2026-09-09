import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end coverage.
 *
 * The unit suite proves the arithmetic; this proves the product. Every spec
 * here drives a real browser through a real journey against a real IndexedDB,
 * and asserts on what a person would see — not on implementation details.
 *
 * Each spec gets a clean database: `test.beforeEach` clears IndexedDB and
 * localStorage before the app boots, so no test can be made to pass by another
 * test's leftovers.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    {
      name: 'still-air',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // The whole product has a reduced-motion path; it is tested, not assumed.
        reducedMotion: 'reduce',
      },
    },
  ],

  // Preview, not dev: the thing shipped is the thing tested.
  webServer: {
    // --host is not optional on Windows: without it preview binds to the
    // hostname 'localhost', which can resolve to ::1 only, and the readiness
    // probe on 127.0.0.1 then waits three minutes for a server that is up.
    command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
})
