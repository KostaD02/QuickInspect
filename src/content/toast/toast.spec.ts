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
});
