import { MODIFIER_KEYS } from '../consts/settings';

export type ModifierKey = (typeof MODIFIER_KEYS)[number];

export interface LensSettings {
  enabled: boolean;
  modifier: ModifierKey;
  showBoxModel: boolean;
  showSelectors: boolean;
  showBox: boolean;
  showStyles: boolean;
  showAccessibility: boolean;
  showAttributes: boolean;
  showContext: boolean;
  showMedia: boolean;
  showEvents: boolean;
  showEditorStatus: boolean;
  allowEdit: boolean;
}

export type LensSettingKey = keyof LensSettings;

export type LensSettingBooleanKey = {
  [K in keyof LensSettings]: LensSettings[K] extends boolean ? K : never;
}[keyof LensSettings];
