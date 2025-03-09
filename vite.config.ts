import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react']
  },
  build: {
    // Enable chunk size warnings
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // Split Supabase
          supabase: ['@supabase/supabase-js'],
          // Split AI features
          ai: ['@google/generative-ai', 'openai']
        }
      }
    },
    // Enable minification optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // Enable source maps for production
  sourcemap: true,
  // Add caching headers
  server: {
    headers: {
      'Cache-Control': 'public, max-age=31536000'
    }
  }
});