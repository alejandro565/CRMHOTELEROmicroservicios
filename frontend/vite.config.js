import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/saas':        { target: 'http://localhost:3001', changeOrigin: true, rewrite: (p) => p.replace(/^\/saas/, '') },
      '/auth':        { target: 'http://localhost:3002', changeOrigin: true, rewrite: (p) => p.replace(/^\/auth/, '') },
      '/hotels':      { target: 'http://localhost:3003', changeOrigin: true, rewrite: (p) => p.replace(/^\/hotels/, '') },
      '/guests':      { target: 'http://localhost:3004', changeOrigin: true, rewrite: (p) => p.replace(/^\/guests/, '') },
      '/reservation': { target: 'http://localhost:3005', changeOrigin: true, rewrite: (p) => p.replace(/^\/reservation/, '') },
      '/billing':     { target: 'http://localhost:3007', changeOrigin: true, rewrite: (p) => p.replace(/^\/billing/, '') },
      '/audit':       { target: 'http://localhost:3008', changeOrigin: true, rewrite: (p) => p.replace(/^\/audit/, '') },
      '/reporting':   { target: 'http://localhost:3009', changeOrigin: true, rewrite: (p) => p.replace(/^\/reporting/, '') },
    },
  },
})