import { chrome } from 'jest-chrome';
import { Toast } from './toast';

describe('toast', () => {
  it('shows and hides after the duration', () => {
    jest.useFakeTimers();
    const root = document.createElement('div');
    const toast = new Toast(root);
    const node = root.querySelector('.toast')!;
    toast.show('Copied', 'x', 100);
    expect(node.classList.contains('show')).toBe(true);
    expect(node.textContent).toContain('Copied');
    toast.show('Again', '', 100);
    jest.advanceTimersByTime(100);
    expect(node.classList.contains('show')).toBe(false);
    jest.useRealTimers();
  });

  it('carries the UI language and its direction into the shadow tree', () => {
    const root = document.createElement('div');
    new Toast(root);
    const node = root.querySelector<HTMLElement>('.toast')!;
    expect(node.lang).toBe('en');
    expect(node.dir).toBe('ltr');
    expect(node.querySelector<HTMLElement>('.code')?.dir).toBe('auto');

    chrome.i18n.getUILanguage.mockReturnValue('he');
    new Toast(root);
    const mirrored = root.querySelectorAll<HTMLElement>('.toast')[1]!;
    expect(mirrored.lang).toBe('he');
    expect(mirrored.dir).toBe('rtl');
  });
});
