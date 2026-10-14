import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json' with { type: 'json' };

export default defineManifest({
  manifest_version: 3,
  name: 'QuickInspect',
  version: pkg.version,
  description: pkg.description,
  icons: {
    48: 'public/logo.png',
    128: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_title: 'QuickInspect',
  },
  content_scripts: [
    {
      js: ['src/content/main.ts'],
      matches: ['https://*/*', 'http://*/*', 'file:///*'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],
  permissions: ['storage'],
});
