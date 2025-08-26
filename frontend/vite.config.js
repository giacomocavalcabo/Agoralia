import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@locales': path.resolve(__dirname, 'locales'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy per evitare problemi CORS in dev
      '/api': {
        target: 'https://service-1-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
