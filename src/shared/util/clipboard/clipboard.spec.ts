import { copyImage, copyText } from './clipboard';

describe('clipboard', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
  });

  it('writes through the async clipboard', async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    expect(await copyText('hi')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hi');
  });

  it('reports failure when the clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    expect(await copyText('hi')).toBe(false);
  });
});

describe('copyImage', () => {
  const blob = new Blob(['png'], { type: 'image/png' });

  beforeEach(() => {
    Object.defineProperty(globalThis, 'ClipboardItem', {
      value: class {
        constructor(readonly items: Record<string, Blob>) {}
      },
      configurable: true,
    });
  });

  it('writes the blob as a clipboard item', async () => {
    const write = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { write },
      configurable: true,
    });
    expect(await copyImage(blob)).toBe(true);
    expect(write).toHaveBeenCalledWith([
      expect.objectContaining({ items: { 'image/png': blob } }),
    ]);
  });

  it('reports failure when the clipboard refuses', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: () => Promise.reject(new Error('denied')) },
      configurable: true,
    });
    expect(await copyImage(blob)).toBe(false);
  });
});
