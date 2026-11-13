import { HOST_TAG } from '@/shared/util';
import styles from '../panel/panel.scss?inline';
import { brandTokens } from '../tokens/tokens';

export class LensHost {
  readonly root: ShadowRoot;
  private readonly element: HTMLElement;

  constructor() {
    this.element = document.createElement(HOST_TAG);
    this.root = this.element.attachShadow({ mode: 'closed' });
    const sheet = document.createElement('style');
    sheet.textContent = brandTokens(':host') + styles;
    this.root.appendChild(sheet);
  }

  mount(): void {
    if (!this.element.isConnected) {
      document.documentElement.appendChild(this.element);
    }
  }

  unmount(): void {
    this.element.remove();
  }

  // ? two frames so the hidden overlay and panel are gone from the screen before the capture
  async conceal<T>(work: () => Promise<T>): Promise<T> {
    this.element.hidden = true;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
    try {
      return await work();
    } finally {
      this.element.hidden = false;
    }
  }
}
