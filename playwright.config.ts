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
  /*
   * Four, not "half the cores".
   *
   * Every worker drives the same `vite preview`, and the routes are lazily
   * chunked now, so eight workers all cold-loading a different chunk at once
   * turn a 200ms navigation into a twenty-second one and fail assertions that
   * are about the product rather than about the harness.
   */
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 30_000,
  expect: { timeout: 7_000 },

  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },

  /*
   * Three projects, and only the DESKTOP one runs everything.
   *
   * A phone has no rail to click and a still-air run has no ceremony to sit
   * through, so running the whole suite three times would mostly be measuring
   * how well the specs guess which chrome they are looking at. Each of the other
   * two runs the specs written for it — and specs that need a second width for
   * one assertion use `test.use({ viewport })` inside their own describe block,
   * which is cheaper and says what it is doing.
   */
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: ['**/mobile.spec.ts', '**/still-air.spec.ts'],
    },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: '**/mobile.spec.ts' },
    {
      name: 'still-air',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // The whole product has a reduced-motion path; it is tested, not assumed.
        reducedMotion: 'reduce',
      },
      testMatch: '**/still-air.spec.ts',
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
