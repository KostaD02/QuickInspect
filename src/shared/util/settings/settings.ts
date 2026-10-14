import {
  DEFAULT_SETTINGS,
  MODIFIER_KEYS,
  SETTINGS_STORAGE_KEY,
} from '../../consts';
import { LensSettings, ModifierKey } from '../../types/settings';

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function normaliseSettings(raw: unknown): LensSettings {
  const stored =
    typeof raw === 'object' && raw !== null
      ? (raw as Partial<Record<keyof LensSettings, unknown>>)
      : {};

  return {
    enabled: bool(stored.enabled, DEFAULT_SETTINGS.enabled),
    modifier: oneOf<ModifierKey>(
      stored.modifier,
      MODIFIER_KEYS,
      DEFAULT_SETTINGS.modifier,
    ),
    showBoxModel: bool(stored.showBoxModel, DEFAULT_SETTINGS.showBoxModel),
    showSelectors: bool(stored.showSelectors, DEFAULT_SETTINGS.showSelectors),
    showBox: bool(stored.showBox, DEFAULT_SETTINGS.showBox),
    showStyles: bool(stored.showStyles, DEFAULT_SETTINGS.showStyles),
    showAccessibility: bool(
      stored.showAccessibility,
      DEFAULT_SETTINGS.showAccessibility,
    ),
    showAttributes: bool(
      stored.showAttributes,
      DEFAULT_SETTINGS.showAttributes,
    ),
    showContext: bool(stored.showContext, DEFAULT_SETTINGS.showContext),
    showMedia: bool(stored.showMedia, DEFAULT_SETTINGS.showMedia),
    showEvents: bool(stored.showEvents, DEFAULT_SETTINGS.showEvents),
  };
}

export async function loadSettings(): Promise<LensSettings> {
  try {
    const data = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const raw: unknown = data[SETTINGS_STORAGE_KEY];
    return normaliseSettings(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: LensSettings): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings });
}

export function watchSettings(
  onChange: (settings: LensSettings) => void,
): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (!(SETTINGS_STORAGE_KEY in changes)) return;
    const raw: unknown = changes[SETTINGS_STORAGE_KEY].newValue;
    onChange(normaliseSettings(raw));
  });
}
