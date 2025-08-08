import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/moringa-ai-access-project-demo',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
  plugins: [react()],
  css: {
    postcss: './postcss.config.js',
  },
  server: {
    port: 3000,
    open: true,
  },
})
