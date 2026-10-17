import { DEV_SERVER_MESSAGE } from '@/shared/types';
import {
  editorAvailability,
  loadSettings,
  logger,
  watchSettings,
} from '@/shared/util';
import { claimPage } from './handover/handover';
import { Inspector } from './inspector/inspector';

const inspector = new Inspector();

const onMessage = (
  message: { type?: unknown },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => {
  if (message.type === DEV_SERVER_MESSAGE) sendResponse(editorAvailability());
};

claimPage(() => {
  inspector.detach();
  try {
    chrome.runtime.onMessage.removeListener(onMessage);
  } catch (error: unknown) {
    logger.warn('Extension context is gone', error);
  }
});

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

chrome.runtime.onMessage.addListener(onMessage);
