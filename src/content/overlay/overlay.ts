import { BoxEdges, BoxInfo, Rect } from '@/shared/types';
import { px } from '@/shared/util';

export class Overlay {
  private readonly element: HTMLDivElement;
  private readonly margin: HTMLDivElement;
  private readonly border: HTMLDivElement;
  private readonly padding: HTMLDivElement;
  private readonly content: HTMLDivElement;
  private readonly gaps: HTMLDivElement[] = [];
  private readonly label: HTMLDivElement;
  private readonly labelText: HTMLSpanElement;
  private readonly labelDims: HTMLSpanElement;
  private showBoxModel = true;

  constructor(root: ParentNode) {
    this.element = document.createElement('div');
    // ? the first class is a hook; the rest are @kostad/brand classes
    this.element.className =
      'overlay kd-pos-fixed kd-top-0 kd-left-0 kd-pointer-none';
    this.element.hidden = true;

    this.margin = this.box('overlay-margin');
    this.border = this.box('overlay-border');
    this.padding = this.box('overlay-padding');
    this.content = this.box('overlay-content');

    this.label = document.createElement('div');
    this.label.className =
      'overlay-label kd-pos-absolute kd-top-0 kd-left-0 kd-px-2 kd-py-1 kd-radius-sm kd-bg-base kd-border-1 kd-shadow-md kd-text-primary kd-font-mono kd-fs-xxxs kd-fw-medium kd-whitespace-nowrap';
    this.labelText = document.createElement('span');
    this.labelDims = document.createElement('span');
    this.labelDims.className = 'dims kd-ml-2 kd-text-muted';
    this.label.append(this.labelText, this.labelDims);

    this.element.append(
      this.margin,
      this.border,
      this.padding,
      this.content,
      this.label,
    );
    root.appendChild(this.element);
  }

  setBoxModel(enabled: boolean): void {
    this.showBoxModel = enabled;
    this.margin.hidden = !enabled;
    this.border.hidden = !enabled;
    this.padding.hidden = !enabled;
  }

  show(target: Element, box: BoxInfo, summary: string): void {
    const rect = target.getBoundingClientRect();
    const { margin, border, padding } = box;

    const left = rect.left - margin.left;
    const top = rect.top - margin.top;
    const width = rect.width + margin.left + margin.right;
    const height = rect.height + margin.top + margin.bottom;

    this.element.hidden = false;
    this.element.style.transform = `translate(${px(left)}, ${px(top)})`;
    this.element.style.width = px(width);
    this.element.style.height = px(height);

    this.place(this.margin, 0, 0, width, height);
    this.place(this.border, margin.left, margin.top, rect.width, rect.height);
    const inner = {
      x: margin.left + border.left,
      y: margin.top + border.top,
      width: Math.max(0, rect.width - border.left - border.right),
      height: Math.max(0, rect.height - border.top - border.bottom),
    };
    this.place(this.padding, inner.x, inner.y, inner.width, inner.height);
    this.place(
      this.content,
      inner.x + padding.left,
      inner.y + padding.top,
      Math.max(0, inner.width - padding.left - padding.right),
      Math.max(0, inner.height - padding.top - padding.bottom),
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
    this.showGaps(this.showBoxModel ? box.gaps : [], margin);

    this.labelText.textContent = summary;
    this.labelDims.textContent = `${box.width.toString()} × ${box.height.toString()}`;
    this.label.classList.toggle('below', top < 28);
  }

  hide(): void {
    this.element.hidden = true;
  }

  // ? gap boxes are reused between elements and the spares hidden
  private showGaps(gaps: Rect[], margin: BoxEdges): void {
    while (this.gaps.length < gaps.length) {
      const gap = this.box('overlay-gap');
      this.element.insertBefore(gap, this.label);
      this.gaps.push(gap);
    }
    this.gaps.forEach((node, index) => {
      const gap = gaps.at(index);
      node.hidden = !gap;
      if (gap) {
        this.place(
          node,
          margin.left + gap.x,
          margin.top + gap.y,
          gap.width,
          gap.height,
        );
      }
    });
  }

  private box(className: string): HTMLDivElement {
    const div = document.createElement('div');
    div.className = `overlay-box ${className} kd-pos-absolute kd-pointer-none`;
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
