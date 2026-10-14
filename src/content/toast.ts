export class Toast {
  private readonly element: HTMLDivElement;
  private readonly message: HTMLSpanElement;
  private readonly code: HTMLSpanElement;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(root: ParentNode) {
    this.element = document.createElement('div');
    this.element.className = 'toast';
    this.message = document.createElement('span');
    this.code = document.createElement('span');
    this.code.className = 'code';
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
