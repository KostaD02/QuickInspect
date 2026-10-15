import { DEFAULT_SETTINGS, MODIFIER_KEYS } from '@/shared/consts';
import {
  DEV_SERVER_MESSAGE,
  DevServer,
  LensSettingBooleanKey,
  LensSettings,
} from '@/shared/types';
import { loadSettings, saveSettings } from '@/shared/util';

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
  };

  private readonly domRefs = {
    modifier: document.getElementById('set-modifier') as HTMLSelectElement,
    settingsBtn: document.getElementById('settings-btn') as HTMLButtonElement,
    settingsCloseBtn: document.getElementById(
      'settings-close-btn',
    ) as HTMLButtonElement,
    settingsPanel: document.getElementById('settings-panel') as HTMLDivElement,
    shell: document.getElementById('shell') as HTMLDivElement,
    footer: document.getElementById('app-footer') as HTMLElement,
    resetBtn: document.getElementById('reset-btn') as HTMLButtonElement,
    versionLabel: document.getElementById('version') as HTMLSpanElement,
    editorStatus: document.getElementById('editor-status') as HTMLDivElement,
    editorLabel: document.getElementById('editor-label') as HTMLSpanElement,
  };

  private settings: LensSettings = { ...DEFAULT_SETTINGS };

  async init(): Promise<void> {
    this.domRefs.versionLabel.textContent = `v${chrome.runtime.getManifest().version}`;
    this.settings = await loadSettings();
    this.apply();
    this.bind();
    this.showEditor(await this.activeDevServer());
  }

  private async activeDevServer(): Promise<DevServer> {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const tab = tabs.at(0);
      if (tab?.id === undefined) return null;
      const reply: unknown = await chrome.tabs.sendMessage(tab.id, {
        type: DEV_SERVER_MESSAGE,
      });
      return reply === 'vite' || reply === 'next' ? reply : null;
    } catch {
      return null;
    }
  }

  private showEditor(server: DevServer): void {
    const { editorStatus, editorLabel } = this.domRefs;
    const labels: Record<Exclude<DevServer, null>, string> = {
      vite: 'Vite dev server, open in editor available',
      next: 'Next.js dev server, open in editor available',
    };
    editorStatus.classList.toggle('available', server !== null);
    editorLabel.textContent = server
      ? labels[server]
      : 'Not available on this page';
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
  }

  private bind(): void {
    const { modifier, settingsBtn, settingsCloseBtn, resetBtn } = this.domRefs;

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
      this.showSettings(true);
    });
    settingsCloseBtn.addEventListener('click', () => {
      this.showSettings(false);
    });

    resetBtn.addEventListener('click', () => {
      this.settings = { ...DEFAULT_SETTINGS };
      this.apply();
      saveSettings(this.settings);
    });
  }

  private showSettings(open: boolean): void {
    const { settingsPanel, settingsBtn, settingsCloseBtn, shell, footer } =
      this.domRefs;
    settingsPanel.hidden = !open;
    settingsBtn.hidden = open;
    settingsCloseBtn.hidden = !open;
    shell.hidden = open;
    footer.hidden = open;
  }

  private update(patch: Partial<LensSettings>): void {
    this.settings = { ...this.settings, ...patch };
    this.apply();
    saveSettings(this.settings);
  }
}
