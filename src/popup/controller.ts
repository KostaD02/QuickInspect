import { DEFAULT_SETTINGS, MODIFIER_KEYS } from '@/shared/consts';
import {
  EditorAvailability,
  LensSettingBooleanKey,
  LensSettings,
  ModifierKey,
} from '@/shared/types';
import { loadSettings, saveSettings } from '@/shared/util';
import { connectTab } from './page';

const MODIFIER_LABELS: Record<ModifierKey, string> = {
  Alt: 'Alt / Option',
  Control: 'Ctrl',
  Shift: 'Shift',
  Meta: 'Cmd / Win',
};

type PopupPanel = 'settings' | 'info';

export class PopupController {
  private readonly toggles: Record<LensSettingBooleanKey, HTMLInputElement> = {
    enabled: this.input('set-enabled'),
    showBoxModel: this.input('set-show-box-model'),
    showSelectors: this.input('set-show-selectors'),
    showBox: this.input('set-show-box'),
    showStyles: this.input('set-show-styles'),
    showAccessibility: this.input('set-show-accessibility'),
    showAttributes: this.input('set-show-attributes'),
    showContext: this.input('set-show-context'),
    showMedia: this.input('set-show-media'),
    showEvents: this.input('set-show-events'),
    showEditorStatus: this.input('set-show-editor-status'),
    allowEdit: this.input('set-allow-edit'),
  };

  private readonly domRefs = {
    modifier: document.getElementById('set-modifier') as HTMLSelectElement,
    enabledSwitch: document.getElementById('enabled-switch') as HTMLElement,
    settingsBtn: document.getElementById('settings-btn') as HTMLButtonElement,
    settingsCloseBtn: document.getElementById(
      'settings-close-btn',
    ) as HTMLButtonElement,
    settingsPanel: document.getElementById('settings-panel') as HTMLDivElement,
    infoBtn: document.getElementById('info-btn') as HTMLButtonElement,
    infoCloseBtn: document.getElementById(
      'info-close-btn',
    ) as HTMLButtonElement,
    infoPanel: document.getElementById('info-panel') as HTMLDivElement,
    infoModifier: document.getElementById('info-modifier') as HTMLElement,
    shell: document.getElementById('shell') as HTMLDivElement,
    footer: document.getElementById('app-footer') as HTMLElement,
    resetBtn: document.getElementById('reset-btn') as HTMLButtonElement,
    versionLabel: document.getElementById('version') as HTMLSpanElement,
    editorGroup: document.getElementById('editor-group') as HTMLDivElement,
    editorStatus: document.getElementById('editor-status') as HTMLDivElement,
    editorLabel: document.getElementById('editor-label') as HTMLSpanElement,
  };

  private settings: LensSettings = { ...DEFAULT_SETTINGS };

  async init(): Promise<void> {
    this.domRefs.versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
    this.settings = await loadSettings();
    this.apply();
    this.bind();
    this.showEditor(await this.activeEditor());
  }

  private async activeEditor(): Promise<EditorAvailability> {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return await connectTab(tabs.at(0));
    } catch {
      return { server: null, sources: false };
    }
  }

  private showEditor({ server, sources }: EditorAvailability): void {
    const { editorStatus, editorLabel } = this.domRefs;
    const name = server === 'vite' ? 'Vite' : 'Next.js';
    editorStatus.classList.toggle('available', sources);
    editorStatus.classList.toggle('partial', server !== null && !sources);
    editorLabel.textContent = !server
      ? 'Not available on this page'
      : sources
        ? `${name} dev server, element sources available`
        : `${name} dev server, but this page exposes no element sources`;
  }

  private input(id: string): HTMLInputElement {
    return document.getElementById(id) as HTMLInputElement;
  }

  private apply(): void {
    for (const [key, box] of Object.entries(this.toggles) as [
      LensSettingBooleanKey,
      HTMLInputElement,
    ][]) {
      box.checked = this.settings[key];
    }
    this.domRefs.modifier.value = this.settings.modifier;
    this.domRefs.infoModifier.textContent =
      MODIFIER_LABELS[this.settings.modifier];
    this.domRefs.editorGroup.hidden = !this.settings.showEditorStatus;
  }

  private bind(): void {
    const {
      modifier,
      settingsBtn,
      settingsCloseBtn,
      infoBtn,
      infoCloseBtn,
      resetBtn,
    } = this.domRefs;

    for (const [key, box] of Object.entries(this.toggles) as [
      LensSettingBooleanKey,
      HTMLInputElement,
    ][]) {
      box.addEventListener('change', () => {
        this.update({ [key]: box.checked });
      });
    }

    modifier.addEventListener('change', () => {
      const value = modifier.value;
      if ((MODIFIER_KEYS as readonly string[]).includes(value)) {
        this.update({ modifier: value as LensSettings['modifier'] });
      }
    });

    settingsBtn.addEventListener('click', () => {
      this.showPanel('settings');
    });
    settingsCloseBtn.addEventListener('click', () => {
      this.showPanel(null);
    });
    infoBtn.addEventListener('click', () => {
      this.showPanel('info');
    });
    infoCloseBtn.addEventListener('click', () => {
      this.showPanel(null);
    });

    resetBtn.addEventListener('click', () => {
      this.settings = { ...DEFAULT_SETTINGS };
      this.apply();
      saveSettings(this.settings);
    });
  }

  private showPanel(panel: PopupPanel | null): void {
    const {
      settingsPanel,
      settingsBtn,
      settingsCloseBtn,
      infoPanel,
      infoBtn,
      infoCloseBtn,
      enabledSwitch,
      shell,
      footer,
    } = this.domRefs;
    const open = panel !== null;
    settingsPanel.hidden = panel !== 'settings';
    infoPanel.hidden = panel !== 'info';
    settingsCloseBtn.hidden = panel !== 'settings';
    infoCloseBtn.hidden = panel !== 'info';
    settingsBtn.hidden = open;
    infoBtn.hidden = open;
    enabledSwitch.hidden = open;
    shell.hidden = open;
    footer.hidden = open;
  }

  private update(patch: Partial<LensSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.apply();
    saveSettings(this.settings);
  }
}
