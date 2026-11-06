import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Capacitor requires relative asset paths and a static output it can copy into the
// native Android shell. Do NOT use absolute base paths — file:// loading breaks on-device.
export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2019',
    // ExcelJS (~940 KB) is the only large chunk; it loads only when Excel import/export is used.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Only the libraries every screen needs are grouped by hand. jsPDF and
        // ExcelJS are left to Rollup's automatic splitting: when they were forced
        // into named chunks, Vite's tiny dynamic-import helper landed inside the
        // PDF chunk, so the 400 KB PDF library loaded on every app start.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'vendor-motion';
          if (/[\\/]node_modules[\\/](dexie|dexie-react-hooks)[\\/]/.test(id)) return 'vendor-db';
          return undefined;
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
