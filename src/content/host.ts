import { HOST_TAG } from '@/shared/util';
import styles from './panel.css?inline';

export class LensHost {
  readonly root: ShadowRoot;
  private readonly element: HTMLElement;

  constructor() {
    this.element = document.createElement(HOST_TAG);
    this.root = this.element.attachShadow({ mode: 'closed' });
    const sheet = document.createElement('style');
    sheet.textContent = styles;
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
}
