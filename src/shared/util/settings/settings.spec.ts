import { chrome } from 'jest-chrome';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../../consts';
import {
  loadSettings,
  normaliseSettings,
  saveSettings,
  watchSettings,
} from './settings';

describe('settings', () => {
  beforeEach(() => {
    chrome.storage.local.get.mockReset();
    chrome.storage.local.set.mockReset();
    chrome.storage.onChanged.clearListeners();
  });

  it('normalises unknown or partial input to defaults', () => {
    expect(normaliseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normaliseSettings('nope')).toEqual(DEFAULT_SETTINGS);
    expect(
      normaliseSettings({
        enabled: false,
        modifier: 'Control',
        showEvents: false,
      }),
    ).toMatchObject({ enabled: false, modifier: 'Control', showEvents: false });
    expect(
      normaliseSettings({ modifier: 'Hyper', showBox: 'yes' }),
    ).toMatchObject({
      modifier: 'Alt',
      showBox: true,
    });
  });

  it('loads from storage and falls back on error', async () => {
    (chrome.storage.local.get as jest.Mock).mockResolvedValue({
      [SETTINGS_STORAGE_KEY]: { showStyles: false },
    });
    expect((await loadSettings()).showStyles).toBe(false);

    (chrome.storage.local.get as jest.Mock).mockRejectedValue(new Error('x'));
    expect(await loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and watches', () => {
    (chrome.storage.local.set as jest.Mock).mockResolvedValue(undefined);
    saveSettings(DEFAULT_SETTINGS);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [SETTINGS_STORAGE_KEY]: DEFAULT_SETTINGS,
    });

    const onChange = jest.fn();
    watchSettings(onChange);
    chrome.storage.onChanged.callListeners({ other: { newValue: 1 } }, 'local');
    chrome.storage.onChanged.callListeners(
      { [SETTINGS_STORAGE_KEY]: { newValue: { enabled: false } } },
      'sync',
    );
    expect(onChange).not.toHaveBeenCalled();
    chrome.storage.onChanged.callListeners(
      { [SETTINGS_STORAGE_KEY]: { newValue: { enabled: false } } },
      'local',
    );
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      enabled: false,
    });
  });
});
