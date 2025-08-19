import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	build: {
		target: 'es2022',
		rollupOptions: {
			output: {
				format: 'es'
			}
		}
	},
	server: {
		proxy: {
			'/ws': {
				target: 'http://localhost:8000',
				ws: true,
				changeOrigin: true
			}
		}
	}
})
