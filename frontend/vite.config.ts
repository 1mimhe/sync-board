import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        ws: true,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            // Suppress benign client socket resets / aborts during page reloads or client tab switches
            if (['ECONNRESET', 'ECONNABORTED', 'EPIPE', 'ECANCELED'].includes(err.code)) {
              return
            }
            console.warn('[vite ws proxy warning]', err.message || err)
          })
        },
      },
    },
  },
})
