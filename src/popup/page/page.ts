import { DEV_SERVER_MESSAGE, EditorAvailability } from '@/shared/types';

const NONE: EditorAvailability = { server: null, sources: false };
const SCRIPTABLE = /^(https?|file):/;
const RETRIES = 20;
const RETRY_DELAY = 100;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ask(
  tabId: number,
  scan: boolean,
): Promise<EditorAvailability | null> {
  try {
    const reply = await chrome.tabs.sendMessage<
      { type: string; scan: boolean },
      Partial<EditorAvailability> | undefined
    >(tabId, { type: DEV_SERVER_MESSAGE, scan });
    const server =
      reply?.server === 'vite' || reply?.server === 'next'
        ? reply.server
        : null;
    return { server, sources: server !== null && reply?.sources === true };
  } catch {
    return null;
  }
}

async function injectContentScripts(tabId: number): Promise<void> {
  for (const script of chrome.runtime.getManifest().content_scripts ?? []) {
    if (!script.js?.length) continue;
    const main = 'world' in script && script.world === 'MAIN';
    await chrome.scripting.executeScript({
      target: { tabId },
      files: script.js,
      world: main ? 'MAIN' : 'ISOLATED',
    });
  }
}

// ? without scan the tab only reports that QuickInspect runs there, and the page is left unscanned
export async function connectTab(
  tab: chrome.tabs.Tab | undefined,
  scan: boolean,
): Promise<EditorAvailability> {
  if (tab?.id === undefined) return NONE;
  const tabId = tab.id;
  const running = await ask(tabId, scan);
  if (running) return running;
  if (tab.url && !SCRIPTABLE.test(tab.url)) return NONE;
  try {
    await injectContentScripts(tabId);
  } catch {
    return NONE;
  }
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    await wait(RETRY_DELAY);
    const started = await ask(tabId, scan);
    if (started) return started;
  }
  return NONE;
}
