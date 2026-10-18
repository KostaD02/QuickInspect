import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'QuickInspect',
  version: pkg.version,
  description: pkg.description,
  // ? content_scripts with world: 'MAIN' need Chrome 111, and the bridge depends on it
  minimum_chrome_version: '111',
  icons: {
    16: 'public/icons/icon-16.png',
    32: 'public/icons/icon-32.png',
    48: 'public/icons/icon-48.png',
    128: 'public/icons/icon-128.png',
  },
  action: {
    default_icon: {
      16: 'public/icons/icon-16.png',
      32: 'public/icons/icon-32.png',
    },
    default_popup: 'src/popup/index.html',
    default_title: 'QuickInspect',
  },
  content_scripts: [
    {
      js: ['bridge/bridge.js'],
      matches: ['https://*/*', 'http://*/*', 'file:///*'],
      run_at: 'document_start',
      all_frames: false,
      world: 'MAIN',
    },
    {
      js: ['src/content/main.ts'],
      matches: ['https://*/*', 'http://*/*', 'file:///*'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  permissions: ['storage', 'clipboardWrite', 'scripting', 'activeTab'],
});
