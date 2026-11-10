import { chrome } from 'jest-chrome';
import { localizePage, plural, t, textDirection, uiLanguage } from './i18n';

describe('i18n util', () => {
  describe('t', () => {
    it('returns the message for a key', () => {
      expect(t('settingsReset')).toBe('Reset to defaults');
    });

    it('substitutes placeholders', () => {
      expect(t('toastCopied', ['selector'])).toBe('Copied selector');
      expect(t('editorSources', 'Vite')).toBe(
        'Vite dev server, element sources available',
      );
    });

    it('returns the key itself when the message is missing', () => {
      expect(t('noSuchMessage')).toBe('noSuchMessage');
    });
  });

  describe('uiLanguage', () => {
    it('reads the browser UI language and falls back to English', () => {
      expect(uiLanguage()).toBe('en');
      chrome.i18n.getUILanguage.mockReturnValue('');
      expect(uiLanguage()).toBe('en');
    });
  });

  describe('plural', () => {
    it('picks the CLDR category of the count', () => {
      expect(plural('listeners', 1)).toBe('1 listener');
      expect(plural('listeners', 5)).toBe('5 listeners');
      expect(plural('children', 1)).toBe('1 child');
      expect(plural('children', 0)).toBe('0 children');
    });

    it('falls back to the other form when a category has no message', () => {
      chrome.i18n.getUILanguage.mockReturnValue('ru');
      expect(plural('listeners', 3)).toBe('3 listeners');
    });

    it('survives a locale the runtime does not know', () => {
      chrome.i18n.getUILanguage.mockReturnValue('not a locale');
      expect(plural('listeners', 2)).toBe('2 listeners');
    });
  });

  describe('localizePage', () => {
    it('fills text, markup and attributes and sets the document language', () => {
      document.head.innerHTML = '<title data-i18n="appName">x</title>';
      document.body.innerHTML = `
        <span data-i18n="holdKeyLabel">x</span>
        <p data-i18n-html="editorHint">x</p>
        <button data-i18n-attr="title:closeTitle; aria-label:infoCloseLabel">x</button>
        <option data-i18n="modifierMeta">x</option>
      `;

      localizePage();

      expect(document.title).toBe('QuickInspect');
      expect(document.querySelector('span')?.textContent).toBe('Hold key');
      expect(document.querySelector('p')?.innerHTML).toBe(
        'Press <kbd class="kd-chip kd-font-mono">O</kbd> on an element with a source location to open it in your editor.',
      );
      expect(document.querySelector('button')?.title).toBe('Close');
      expect(document.querySelector('button')?.getAttribute('aria-label')).toBe(
        'Close info',
      );
      expect(document.querySelector('option')?.textContent).toBe('Cmd / Win');
      expect(document.documentElement.lang).toBe('en');
    });

    it('sets the text direction from the predefined bidi message', () => {
      expect(textDirection()).toBe('ltr');
      localizePage();
      expect(document.documentElement.dir).toBe('ltr');

      chrome.i18n.getMessage.mockImplementation((key: string) =>
        key === '@@bidi_dir' ? 'rtl' : '',
      );
      expect(textDirection()).toBe('rtl');
      localizePage();
      expect(document.documentElement.dir).toBe('rtl');
    });

    it('falls back to the UI language when the bidi message says ltr', () => {
      chrome.i18n.getMessage.mockImplementation(() => 'ltr');
      chrome.i18n.getUILanguage.mockReturnValue('he');
      expect(textDirection()).toBe('rtl');

      chrome.i18n.getUILanguage.mockReturnValue('ar-EG');
      localizePage();
      expect(document.documentElement.dir).toBe('rtl');

      chrome.i18n.getUILanguage.mockReturnValue('en-US');
      expect(textDirection()).toBe('ltr');
    });

    it('leaves elements without a key alone', () => {
      document.body.innerHTML =
        '<span data-i18n="">keep</span><b data-i18n-attr="title">keep</b>';

      localizePage();

      expect(document.querySelector('span')?.textContent).toBe('');
      expect(document.querySelector('b')?.hasAttribute('title')).toBe(false);
    });
  });
});
