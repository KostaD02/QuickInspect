import { chrome } from 'jest-chrome';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/shared/consts';
import { PopupController } from './controller';

const ids = [
  'set-enabled',
  'set-show-box-model',
  'set-show-selectors',
  'set-show-box',
  'set-show-styles',
  'set-show-accessibility',
  'set-show-attributes',
  'set-show-context',
  'set-show-media',
  'set-show-events',
];

describe('popup controller', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      ${ids.map((id) => `<input id="${id}" type="checkbox">`).join('')}
      <select id="set-modifier"><option>Alt</option><option>Control</option></select>
      <button id="settings-btn"></button>
      <button id="settings-close-btn" hidden></button>
      <div id="settings-panel" hidden></div>
      <div id="shell"></div>
      <footer id="app-footer"></footer>
      <button id="reset-btn"></button>
      <span id="version"></span>
      <div id="editor-status"><span id="editor-label"></span></div>`;
    chrome.runtime.getManifest.mockReturnValue({
      version: '9.9.9',
    } as chrome.runtime.Manifest);
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      [SETTINGS_STORAGE_KEY]: { enabled: false, modifier: 'Control' },
    });
    chrome.storage.local.set.mockReset();
    (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 7 }]);
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue('vite');
  });

  it('shows whether the active tab can open files in the editor', async () => {
    await new PopupController().init();
    const status = document.getElementById('editor-status') as HTMLElement;
    expect(status.classList.contains('available')).toBe(true);
    expect(status.textContent).toContain('Vite dev server');
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: 'quickinspect:dev-server',
    });

    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue('next');
    await new PopupController().init();
    expect(status.textContent).toContain('Next.js dev server');

    (chrome.tabs.sendMessage as jest.Mock).mockRejectedValue(
      new Error('no receiver'),
    );
    await new PopupController().init();
    expect(status.classList.contains('available')).toBe(false);
    expect(status.textContent).toContain('Not available on this page');

    (chrome.tabs.query as jest.Mock).mockResolvedValue([]);
    await new PopupController().init();
    expect(status.textContent).toContain('Not available on this page');
  });

  it('reflects stored settings and writes changes back', async () => {
    await new PopupController().init();

    expect(document.getElementById('version')?.textContent).toBe('v9.9.9');
    const enabled = document.getElementById('set-enabled') as HTMLInputElement;
    expect(enabled.checked).toBe(false);

    enabled.checked = true;
    enabled.dispatchEvent(new Event('change'));
    expect(chrome.storage.local.set).toHaveBeenLastCalledWith({
      [SETTINGS_STORAGE_KEY]: expect.objectContaining({
        enabled: true,
        modifier: 'Control',
      }),
    });

    const events = document.getElementById(
      'set-show-events',
    ) as HTMLInputElement;
    events.checked = false;
    events.dispatchEvent(new Event('change'));
    expect(chrome.storage.local.set).toHaveBeenLastCalledWith({
      [SETTINGS_STORAGE_KEY]: expect.objectContaining({ showEvents: false }),
    });

    const modifier = document.getElementById(
      'set-modifier',
    ) as HTMLSelectElement;
    modifier.value = 'Alt';
    modifier.dispatchEvent(new Event('change'));
    expect(chrome.storage.local.set).toHaveBeenLastCalledWith({
      [SETTINGS_STORAGE_KEY]: expect.objectContaining({ modifier: 'Alt' }),
    });

    document.getElementById('reset-btn')?.click();
    expect(chrome.storage.local.set).toHaveBeenLastCalledWith({
      [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS,
    });
  });

  it('swaps the shell for the settings panel', async () => {
    await new PopupController().init();
    const panel = document.getElementById('settings-panel') as HTMLElement;
    const shell = document.getElementById('shell') as HTMLElement;
    document.getElementById('settings-btn')?.click();
    expect(panel.hidden).toBe(false);
    expect(shell.hidden).toBe(true);
    document.getElementById('settings-close-btn')?.click();
    expect(panel.hidden).toBe(true);
    expect(shell.hidden).toBe(false);
  });
});
