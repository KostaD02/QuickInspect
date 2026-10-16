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
  'set-show-editor-status',
  'set-allow-edit',
];

describe('popup controller', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      ${ids.map((id) => `<input id="${id}" type="checkbox">`).join('')}
      <select id="set-modifier"><option>Alt</option><option>Control</option></select>
      <label id="enabled-switch"></label>
      <button id="settings-btn"></button>
      <button id="settings-close-btn" hidden></button>
      <div id="settings-panel" hidden></div>
      <button id="info-btn"></button>
      <button id="info-close-btn" hidden></button>
      <div id="info-panel" hidden><kbd id="info-modifier"></kbd></div>
      <div id="shell"></div>
      <footer id="app-footer"></footer>
      <button id="reset-btn"></button>
      <span id="version"></span>
      <div id="editor-group"><div id="editor-status"><span id="editor-label"></span></div></div>`;
    chrome.runtime.getManifest.mockReturnValue({
      version: '9.9.9',
      content_scripts: [{ js: ['main.js'], matches: ['<all_urls>'] }],
    } as unknown as chrome.runtime.Manifest);
    Object.assign(chrome, {
      scripting: {
        executeScript: jest.fn(() => Promise.reject(new Error('blocked'))),
      },
    });
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      [SETTINGS_STORAGE_KEY]: { enabled: false, modifier: 'Control' },
    });
    chrome.storage.local.set.mockReset();
    (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
    (chrome.tabs.query as jest.Mock).mockResolvedValue([{ id: 7 }]);
    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({
      server: 'vite',
      sources: true,
    });
  });

  it('shows whether the active tab can open files in the editor', async () => {
    await new PopupController().init();
    const status = document.getElementById('editor-status') as HTMLElement;
    expect(status.classList.contains('available')).toBe(true);
    expect(status.textContent).toContain('Vite dev server, element sources');
    const group = document.getElementById('editor-group') as HTMLElement;
    expect(group.hidden).toBe(false);
    const toggle = document.getElementById(
      'set-show-editor-status',
    ) as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    expect(group.hidden).toBe(true);
    expect(chrome.storage.local.set).toHaveBeenLastCalledWith({
      [SETTINGS_STORAGE_KEY]: expect.objectContaining({
        showEditorStatus: false,
      }),
    });
    expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, {
      type: 'quickinspect:dev-server',
    });

    (chrome.tabs.sendMessage as jest.Mock).mockResolvedValue({
      server: 'next',
      sources: false,
    });
    await new PopupController().init();
    expect(status.classList.contains('available')).toBe(false);
    expect(status.classList.contains('partial')).toBe(true);
    expect(status.textContent).toContain('exposes no element sources');

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

  it('starts QuickInspect on a tab that does not answer yet', async () => {
    const executeScript = jest.fn(() => Promise.resolve([]));
    Object.assign(chrome, { scripting: { executeScript } });
    (chrome.tabs.sendMessage as jest.Mock)
      .mockRejectedValueOnce(new Error('no receiver'))
      .mockResolvedValue({ server: 'vite', sources: true });
    await new PopupController().init();
    expect(executeScript).toHaveBeenCalledWith({
      target: { tabId: 7 },
      files: ['main.js'],
      world: 'ISOLATED',
    });
    const status = document.getElementById('editor-status') as HTMLElement;
    expect(status.textContent).toContain('Vite dev server, element sources');

    (chrome.tabs.query as jest.Mock).mockRejectedValue(new Error('gone'));
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

  function el(id: string): HTMLElement {
    return document.getElementById(id) as HTMLElement;
  }

  function header(): Record<string, boolean> {
    return Object.fromEntries(
      [
        'settings-btn',
        'settings-close-btn',
        'info-btn',
        'info-close-btn',
        'enabled-switch',
        'shell',
        'app-footer',
      ].map((id) => [id, el(id).hidden === true]),
    );
  }

  it('swaps the shell and header controls for the settings panel', async () => {
    await new PopupController().init();
    el('settings-btn').click();
    expect(el('settings-panel').hidden).toBe(false);
    expect(el('info-panel').hidden).toBe(true);
    expect(header()).toEqual({
      'settings-btn': true,
      'settings-close-btn': false,
      'info-btn': true,
      'info-close-btn': true,
      'enabled-switch': true,
      shell: true,
      'app-footer': true,
    });
    el('settings-close-btn').click();
    expect(el('settings-panel').hidden).toBe(true);
    expect(header()).toEqual({
      'settings-btn': false,
      'settings-close-btn': true,
      'info-btn': false,
      'info-close-btn': true,
      'enabled-switch': false,
      shell: false,
      'app-footer': false,
    });
  });

  it('opens the info panel with only a close button and the current hold key', async () => {
    await new PopupController().init();
    expect(el('info-modifier').textContent).toBe('Ctrl');
    el('info-btn').click();
    expect(el('info-panel').hidden).toBe(false);
    expect(el('settings-panel').hidden).toBe(true);
    expect(header()).toMatchObject({
      'settings-btn': true,
      'info-btn': true,
      'info-close-btn': false,
      'settings-close-btn': true,
      'enabled-switch': true,
      shell: true,
    });
    el('info-close-btn').click();
    expect(el('info-panel').hidden).toBe(true);
    expect(el('enabled-switch').hidden).toBe(false);

    const allowEdit = el('set-allow-edit') as HTMLInputElement;
    expect(allowEdit.checked).toBe(true);
    allowEdit.checked = false;
    allowEdit.dispatchEvent(new Event('change'));
    expect(chrome.storage.local.set).toHaveBeenLastCalledWith({
      [SETTINGS_STORAGE_KEY]: expect.objectContaining({ allowEdit: false }),
    });
  });
});
