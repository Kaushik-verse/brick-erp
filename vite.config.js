import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Capacitor requires relative asset paths and a static output it can copy into the
// native Android shell. Do NOT use absolute base paths — file:// loading breaks on-device.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2019',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          'vendor-excel': ['exceljs'],
          'vendor-db': ['dexie', 'dexie-react-hooks'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
});
