import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@engine': resolve(__dirname, 'src/engine'),
      '@components': resolve(__dirname, 'src/components'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@styles': resolve(__dirname, 'src/styles'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    minify: 'terser',
    sourcemap: true,
  },
});
