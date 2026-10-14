import { LensSettings } from '../types/settings';

export const DEFAULT_SETTINGS: LensSettings = {
  enabled: true,
  modifier: 'Alt',
  showBoxModel: true,
  showSelectors: true,
  showBox: true,
  showStyles: true,
  showAccessibility: true,
  showAttributes: true,
  showContext: true,
  showMedia: true,
  showEvents: true,
};

export const MODIFIER_KEYS = ['Alt', 'Control', 'Shift', 'Meta'] as const;
