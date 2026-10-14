import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(import.meta.dirname, 'src')}`,
    },
  },
  build: {
    outDir: 'bridge',
    emptyOutDir: false,
    copyPublicDir: false,
    minify: false,
    lib: {
      entry: 'src/content/bridge.ts',
      formats: ['iife'],
      name: 'ElementLensBridge',
      fileName: () => 'bridge.js',
    },
  },
});
