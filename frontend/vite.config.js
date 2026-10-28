import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const localPath = path => fileURLToPath(new URL(path, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    allowedHosts: ['localhost'],
    fs: {
      strict: true,
      allow: [localPath('./'), localPath('../interfaces'), localPath('../core'), localPath('../node_modules')],
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/*.sqlite', '**/*.sqlite-*', '**/backend/**', '**/.aws/**'],
    },
    proxy: {
      '/api': {
        target: process.env.GABBAI_API_TARGET || 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },
})
