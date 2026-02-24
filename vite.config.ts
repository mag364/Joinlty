import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  root: 'renderer',
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: {
        entry: fileURLToPath(new URL('./main/index.ts', import.meta.url)),
        vite: {
          build: {
            outDir: '../dist-electron',
            sourcemap: true,
            rollupOptions: {
              external: ['better-sqlite3', 'electron'],
            },
          },
        },
      },
      preload: {
        input: fileURLToPath(new URL('./preload/index.ts', import.meta.url)),
        vite: {
          build: {
            outDir: '../dist-electron',
            sourcemap: true,
          },
        },
      },
      renderer: {},
    }),
  ],
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL('./renderer/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
