import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  server: { port: 5178 },
  resolve: {
    alias: {
      '@components': fileURLToPath(new URL('./src/components', import.meta.url)),
      '@pages':      fileURLToPath(new URL('./src/pages', import.meta.url)),
      '@modules':    fileURLToPath(new URL('./src/modules', import.meta.url)),
      '@context':    fileURLToPath(new URL('./src/context', import.meta.url)),
      '@utils':      fileURLToPath(new URL('./src/utils', import.meta.url)),
    },
  },
})
