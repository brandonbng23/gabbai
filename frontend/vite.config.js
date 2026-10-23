import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.GABBAI_API_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },
})
