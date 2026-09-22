import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'supabase'
          if (id.includes('node_modules/react')) return 'react'
          if (id.includes('node_modules/lucide-react')) return 'icons'
        },
      },
    },
  },
  server: {
    strictPort: true,
    port: 5173,
    proxy: {
      // En desarrollo local: redirige /api/* al worker en el puerto 8080.
      // En producción VITE_WORKER_URL se define, por lo que este proxy no aplica.
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
