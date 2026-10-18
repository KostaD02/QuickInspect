import { chrome } from 'jest-chrome';
import { DEV_SERVER_MESSAGE } from '@/shared/types';
import { connectTab } from './page';

const executeScript = jest.fn();
const none = { server: null, sources: false };

function tab(id: number, url?: string): chrome.tabs.Tab {
  return { id, url } as chrome.tabs.Tab;
}

describe('page connection', () => {
  beforeEach(() => {
    Object.assign(chrome, { scripting: { executeScript } });
    executeScript.mockReset().mockResolvedValue([]);
    (chrome.tabs.sendMessage as jest.Mock).mockReset();
    chrome.runtime.getManifest.mockReturnValue({
      content_scripts: [
        { js: ['bridge.js'], matches: ['<all_urls>'], world: 'MAIN' },
        { js: ['main.js'], matches: ['<all_urls>'] },
        { matches: ['<all_urls>'] },
      ],
    } as unknown as chrome.runtime.Manifest);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('asks a running page without injecting anything', async () => {
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({
      server: 'next',
      sources: true,
    });
    expect(await connectTab(tab(3, 'https://a.test/'), true)).toEqual({
      server: 'next',
      sources: true,
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
      type: DEV_SERVER_MESSAGE,
      scan: true,
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('tells the page not to scan when the editor row is off', async () => {
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue(none);
    expect(await connectTab(tab(3, 'https://a.test/'), false)).toEqual(none);
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(3, {
      type: DEV_SERVER_MESSAGE,
      scan: false,
    });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('injects the manifest scripts in order and waits for them to answer', async () => {
    (chrome.tabs.sendMessage as jest.Mock)
      .mockRejectedValueOnce(new Error('no receiver'))
      .mockRejectedValueOnce(new Error('still loading'))
      .mockResolvedValue({ server: 'vite', sources: false });
    jest.useFakeTimers();
    const pending = connectTab(tab(4, 'http://b.test/'), true);
    await jest.advanceTimersByTimeAsync(300);
    expect(await pending).toEqual({ server: 'vite', sources: false });
    expect(executeScript.mock.calls).toEqual([
      [{ target: { tabId: 4 }, files: ['bridge.js'], world: 'MAIN' }],
      [{ target: { tabId: 4 }, files: ['main.js'], world: 'ISOLATED' }],
    ]);
  });

  it('gives up quietly when injection fails or nothing starts', async () => {
    (chrome.tabs.sendMessage as jest.Mock).mockRejectedValue(
      new Error('no receiver'),
    );
    executeScript.mockRejectedValueOnce(new Error('Cannot access the page'));
    expect(await connectTab(tab(5), true)).toEqual(none);

    jest.useFakeTimers();
    const pending = connectTab(tab(5, 'file:///x.html'), true);
    await jest.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual(none);
    expect(executeScript).toHaveBeenCalledTimes(3);
  });

  it('leaves browser pages and missing tabs alone', async () => {
    (chrome.tabs.sendMessage as jest.Mock).mockRejectedValue(
      new Error('no receiver'),
    );
    expect(await connectTab(tab(6, 'chrome://extensions/'), true)).toEqual(
      none,
    );
    expect(await connectTab(undefined, true)).toEqual(none);
    expect(executeScript).not.toHaveBeenCalled();
  });
});
