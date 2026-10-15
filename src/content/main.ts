import { DEV_SERVER_MESSAGE } from '@/shared/types';
import {
  detectDevServer,
  loadSettings,
  logger,
  watchSettings,
} from '@/shared/util';
import { Inspector } from './inspector';

const inspector = new Inspector();
inspector.attach();

loadSettings()
  .then((settings) => {
    inspector.setSettings(settings);
  })
  .catch((error: unknown) => {
    logger.warn('Falling back to default settings', error);
  });

watchSettings((settings) => {
  inspector.setSettings(settings);
});

chrome.runtime.onMessage.addListener(
  (message: { type?: unknown }, _sender, sendResponse) => {
    if (message.type === DEV_SERVER_MESSAGE) sendResponse(detectDevServer());
  },
);
