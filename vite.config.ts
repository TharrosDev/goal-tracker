import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Stamped into the bundle and onto the service worker's URL, so each deploy is
// a distinct worker with a distinct cache. Node time is fine here: this runs
// once, at build.
const BUILD_ID = Date.now().toString(36)

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    /*
     * NO manualChunks. The `React.lazy()` boundary in `routes/Campaign.tsx` is
     * already the split point, and the bundler honours it: three and
     * @react-three land in the CampaignScene chunk, fetched only by somebody who
     * opens the campaign, while react and react-dom stay in the entry.
     *
     * Naming a `webgl` manual group did the exact opposite of what it looked
     * like. Rolldown forms the manual group first and then places the entry's
     * shared vendor modules into that group's chunk — so react, react-dom,
     * scheduler and zustand ended up INSIDE the 1.09 MB three.js chunk, which
     * made it a STATIC import of the entry, correctly modulepreloaded from
     * index.html. Everybody who opened the war table downloaded the whole of
     * three.js before first paint, and the lazy boundary bought nothing.
     *
     * Do not re-add it, and do not reach for
     * `build.modulePreload.resolveDependencies` to hide the preload link: that
     * removes the hint while leaving the static import, which turns a parallel
     * fetch into a serial one and is measurably worse.
     */
    // The lazily-loaded campaign chunk is legitimately large; the warning is
    // about the critical path, and three.js is no longer on it.
    chunkSizeWarningLimit: 1000,
  },
})
