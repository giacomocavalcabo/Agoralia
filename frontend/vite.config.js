import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-router': ['react-router-dom'],
          'vendor-ui': ['@heroicons/react']
        }
      }
    },
    chunkSizeWarningLimit: 300, // Riduco warning limit
    target: 'es2020' // Target modern browsers
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  }
})
