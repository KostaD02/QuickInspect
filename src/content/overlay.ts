import { BoxInfo } from '@/shared/types';
import { px } from '@/shared/util';

export class Overlay {
  private readonly element: HTMLDivElement;
  private readonly margin: HTMLDivElement;
  private readonly padding: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly labelText: HTMLSpanElement;
  private readonly labelDims: HTMLSpanElement;
  private showBoxModel = true;

  constructor(root: ParentNode) {
    this.element = document.createElement('div');
    this.element.className = 'overlay';
    this.element.hidden = true;

    this.margin = this.box('overlay-margin');
    this.padding = this.box('overlay-padding');
    this.content = this.box('overlay-content');

    this.label = document.createElement('div');
    this.label.className = 'overlay-label';
    this.labelText = document.createElement('span');
    this.labelDims = document.createElement('span');
    this.labelDims.className = 'dims';
    this.label.append(this.labelText, this.labelDims);

    this.element.append(this.margin, this.padding, this.content, this.label);
    root.appendChild(this.element);
  }

  setBoxModel(enabled: boolean): void {
    this.showBoxModel = enabled;
    this.margin.hidden = !enabled;
    this.padding.hidden = !enabled;
  }

  show(target: Element, box: BoxInfo, summary: string): void {
    const rect = target.getBoundingClientRect();
    const { margin, padding } = box;

    const left = rect.left - margin.left;
    const top = rect.top - margin.top;
    const width = rect.width + margin.left + margin.right;
    const height = rect.height + margin.top + margin.bottom;

    this.element.hidden = false;
    this.element.style.transform = `translate(${px(left)}, ${px(top)})`;
    this.element.style.width = px(width);
    this.element.style.height = px(height);

    this.place(this.margin, 0, 0, width, height);
    this.place(this.padding, margin.left, margin.top, rect.width, rect.height);
    this.place(
      this.content,
      margin.left + padding.left,
      margin.top + padding.top,
      Math.max(0, rect.width - padding.left - padding.right),
      Math.max(0, rect.height - padding.top - padding.bottom),
    );

    if (!this.showBoxModel) {
      this.place(
        this.content,
        margin.left,
        margin.top,
        rect.width,
        rect.height,
      );
    }

    this.labelText.textContent = summary;
    this.labelDims.textContent = `${box.width.toString()} × ${box.height.toString()}`;
    this.label.classList.toggle('below', top < 28);
  }

  hide(): void {
    this.element.hidden = true;
  }

  private box(className: string): HTMLDivElement {
    const div = document.createElement('div');
    div.className = `overlay-box ${className}`;
    return div;
  }

  private place(
    node: HTMLElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    node.style.left = px(x);
    node.style.top = px(y);
    node.style.width = px(width);
    node.style.height = px(height);
  }
}
