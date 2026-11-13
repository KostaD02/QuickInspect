import { downloadBlob, fileName } from './download';

describe('download', () => {
  it('turns the element summary into a safe file name', () => {
    expect(fileName('button#go.primary', 'png')).toBe('button-go.primary.png');
    expect(fileName('div[role="dialog"]', 'png')).toBe('div-role-dialog.png');
    expect(fileName('#…', 'png')).toBe('element.png');
    expect(fileName('a'.repeat(80), 'png')).toBe(`${'a'.repeat(60)}.png`);
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
