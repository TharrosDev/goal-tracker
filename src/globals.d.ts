/**
 * Build-time constants, replaced by Vite (see `define` in vite.config.ts).
 *
 * `__BUILD_ID__` names the build. It is the service worker's cache key and the
 * query string on its registration URL, which is what makes a deploy a
 * genuinely different worker rather than the same bytes at the same path.
 */
declare const __BUILD_ID__: string
