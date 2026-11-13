import { CAPTURE_MESSAGE } from '@/shared/types';

chrome.runtime.onMessage.addListener(
  (
    message: { type?: unknown },
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    const windowId = sender.tab?.windowId;
    if (message.type !== CAPTURE_MESSAGE || windowId === undefined) return;
    chrome.tabs
      .captureVisibleTab(windowId, { format: 'png' })
      .then(sendResponse, () => {
        sendResponse(null);
      });
    return true;
  },
);
