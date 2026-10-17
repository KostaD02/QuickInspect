export class Toast {
  private readonly element: HTMLDivElement;
  private readonly message: HTMLSpanElement;
  private readonly code: HTMLSpanElement;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: ParentNode) {
    this.element = document.createElement('div');
    // ? the first class is a hook; the rest are @kostad/brand classes
    this.element.className =
      'toast kd-pos-fixed kd-px-3 kd-py-2 kd-radius-md kd-bg-base kd-border-1 kd-border-accent-line kd-shadow-md kd-text-accent kd-fs-xxxs kd-fw-semibold kd-pointer-none kd-transition-fast';
    this.message = document.createElement('span');
    this.code = document.createElement('span');
    this.code.className =
      'code kd-d-inline-block kd-ml-2 kd-font-mono kd-fs-micro kd-fw-regular kd-text-secondary kd-text-ellipsis';
    this.element.append(this.message, this.code);
    root.appendChild(this.element);
  }

  show(message: string, detail = '', duration = 1400): void {
    this.message.textContent = message;
    this.code.textContent = detail;
    this.code.hidden = !detail;
    this.element.classList.add('show');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.element.classList.remove('show');
    }, duration);
  }
}
