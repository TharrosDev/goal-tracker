import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        // three + r3f are the only genuinely heavy deps; keep them off the
        // critical path so logging progress never waits on the universe.
        manualChunks(id) {
          if (id.includes('node_modules/three') || id.includes('@react-three')) return 'webgl'
        },
      },
    },
  },
})
