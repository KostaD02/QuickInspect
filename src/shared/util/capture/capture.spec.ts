import { CAPTURE_MESSAGE } from '@/shared/types';
import { captureElement, cropRect } from './capture';

const rect = { x: 10, y: 20, width: 100, height: 50 };
const sendMessage = chrome.runtime.sendMessage as jest.Mock;

describe('capture', () => {
  beforeEach(() => {
    sendMessage.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clips the rect to the viewport and scales it to device pixels', () => {
    expect(cropRect(rect, 2)).toEqual({
      x: 20,
      y: 40,
      width: 200,
      height: 100,
    });
    expect(cropRect({ x: -10, y: -10, width: 30, height: 30 }, 1)).toEqual({
      x: 0,
      y: 0,
      width: 20,
      height: 20,
    });
    expect(cropRect({ x: 10, y: 10, width: 5000, height: 10 }, 1)?.width).toBe(
      window.innerWidth - 10,
    );
    expect(cropRect({ x: -50, y: 0, width: 20, height: 20 }, 1)).toBeNull();
    expect(cropRect({ x: 0, y: 0, width: 0, height: 20 }, 1)).toBeNull();
  });

  it('gives up on an off-screen element without asking the worker', async () => {
    expect(
      await captureElement({ x: -50, y: 0, width: 20, height: 20 }),
    ).toBeNull();
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });

  it('returns null when the worker fails or answers without an image', async () => {
    sendMessage.mockImplementationOnce(() => Promise.reject(new Error('gone')));
    expect(await captureElement(rect)).toBeNull();
    sendMessage.mockImplementationOnce(() => Promise.resolve(null));
    expect(await captureElement(rect)).toBeNull();
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: CAPTURE_MESSAGE,
    });
  });

  it('returns null when the image does not load', async () => {
    sendMessage.mockImplementationOnce(() =>
      Promise.resolve('data:image/png;base64,AAAA'),
    );
    jest
      .spyOn(window.HTMLImageElement.prototype, 'src', 'set')
      .mockImplementation(function (this: HTMLImageElement) {
        this.onerror?.(new Event('error'));
      });
    expect(await captureElement(rect)).toBeNull();
  });

  it('crops the capture onto a canvas and hands back a PNG blob', async () => {
    sendMessage.mockImplementationOnce(() =>
      Promise.resolve('data:image/png;base64,AAAA'),
    );
    jest
      .spyOn(window.HTMLImageElement.prototype, 'src', 'set')
      .mockImplementation(function (this: HTMLImageElement) {
        this.onload?.(new Event('load'));
      });
    const drawImage = jest.fn();
    const blob = new Blob(['png'], { type: 'image/png' });
    jest
      .spyOn(window.HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    jest
      .spyOn(window.HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) => {
        callback(blob);
      });
    expect(await captureElement(rect)).toBe(blob);
    expect(drawImage).toHaveBeenCalledWith(
      expect.any(window.HTMLImageElement),
      10,
      20,
      100,
      50,
      0,
      0,
      100,
      50,
    );
  });

  it('returns null without a 2d context', async () => {
    sendMessage.mockImplementationOnce(() =>
      Promise.resolve('data:image/png;base64,AAAA'),
    );
    jest
      .spyOn(window.HTMLImageElement.prototype, 'src', 'set')
      .mockImplementation(function (this: HTMLImageElement) {
        this.onload?.(new Event('load'));
      });
    jest
      .spyOn(window.HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null);
    expect(await captureElement(rect)).toBeNull();
  });
});
