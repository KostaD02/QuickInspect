import path from 'node:path';
import { crx } from '@crxjs/vite-plugin';
import { NodePackageImporter } from 'sass';
import { defineConfig } from 'vite';
import zip from 'vite-plugin-zip-pack';
import manifest from './manifest.config.ts';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  css: {
    preprocessorOptions: {
      // ? lets panel.scss pull single @kostad/brand partials with pkg: URLs
      scss: { importers: [new NodePackageImporter()] },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  plugins: [
    crx({
      manifest,
      contentScripts: { standaloneFiles: ['bridge/bridge.js'] },
    }),
    zip({ outDir: 'release', outFileName: `QuickInspect-${pkg.version}.zip` }),
  ],
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
});
