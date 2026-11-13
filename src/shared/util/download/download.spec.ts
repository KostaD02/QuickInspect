import { downloadBlob, fileName, timestamp } from './download';

describe('download', () => {
  const date = new Date(2026, 10, 13, 9, 5);

  it('orders the date the way the locale writes it', () => {
    expect(timestamp(date, 'en-US')).toBe('11-13-2026-09-05');
    expect(timestamp(date, 'de')).toBe('13-11-2026-09-05');
    expect(timestamp(date, 'ja')).toBe('2026-11-13-09-05');
    expect(timestamp(date, 'ar')).toBe('13-11-2026-09-05');
    expect(timestamp(date, 'not a locale')).toBe('13-11-2026-09-05');
  });

  it('names the file after the element and the time', () => {
    expect(fileName('button#go.primary', date, 'png')).toBe(
      'QuickInspect-button-go-primary-11-13-2026-09-05.png',
    );
    expect(fileName('#…', date, 'png')).toBe(
      'QuickInspect-element-11-13-2026-09-05.png',
    );
    expect(fileName('a'.repeat(80), date, 'png')).toBe(
      `QuickInspect-${'a'.repeat(60)}-11-13-2026-09-05.png`,
    );
  });

  it('clicks a download link for the blob and frees the URL later', () => {
    jest.useFakeTimers();
    const createObjectURL = jest.fn(() => 'blob:x');
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.href).toBe('blob:x');
        expect(this.download).toBe('shot.png');
      });
    const blob = new Blob(['png'], { type: 'image/png' });
    downloadBlob(blob, 'shot.png');
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
    click.mockRestore();
    jest.useRealTimers();
  });
});
