import { CAPTURE_MESSAGE, Rect } from '@/shared/types';

// ? the capture is the viewport in device pixels, so the rect is clipped to it and scaled
export function cropRect(
  rect: Rect,
  scale = window.devicePixelRatio,
): Rect | null {
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const right = Math.min(window.innerWidth, rect.x + rect.width);
  const bottom = Math.min(window.innerHeight, rect.y + rect.height);
  if (right <= left || bottom <= top) return null;
  return {
    x: Math.round(left * scale),
    y: Math.round(top * scale),
    width: Math.round((right - left) * scale),
    height: Math.round((bottom - top) * scale),
  };
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      resolve(null);
    };
    image.src = url;
  });
}

export async function captureElement(rect: Rect): Promise<Blob | null> {
  const crop = cropRect(rect);
  if (!crop) return null;
  let dataUrl: unknown;
  try {
    dataUrl = await chrome.runtime.sendMessage({ type: CAPTURE_MESSAGE });
  } catch {
    return null;
  }
  if (typeof dataUrl !== 'string') return null;
  const image = await loadImage(dataUrl);
  if (!image) return null;
  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
}
