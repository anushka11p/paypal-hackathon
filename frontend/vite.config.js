import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const backend = 'http://localhost:8000'
const apiPaths = ['/health', '/catalog', '/mandates', '/audit', '/demo', '/checkout', '/mock-checkout']

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(apiPaths.map((p) => [p, { target: backend, changeOrigin: false }])),
  },
})
