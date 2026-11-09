import {
  ElementInfo,
  LensSettings,
  Locator,
  LocatorStrategy,
  StyleEntry,
} from '@/shared/types';
import {
  bestLocator,
  formatDuration,
  formatSource,
  plural,
  t,
  textDirection,
  truncate,
  uiLanguage,
} from '@/shared/util';
import { COPY_ACTIONS, CopyAction } from '../actions/actions';
import { EditField } from '../edits/edits';

export interface PanelHandlers {
  copy: (action: CopyAction) => void;
  open: () => void;
  read: (field: EditField) => string;
  write: (field: EditField, value: string | null) => boolean;
  revert: () => void;
}

export interface RenderOptions {
  edited?: boolean;
  keepScroll?: boolean;
}

interface Editable {
  field: EditField;
  placeholder: string;
}

interface Editor extends Editable {
  input: HTMLInputElement;
  target: HTMLElement;
  initial: string;
}

const OFFSET = 18;
const EDGE = 8;

const STRATEGY_KEYS: Record<LocatorStrategy, string> = {
  testId: 'strategyTestId',
  role: 'strategyRole',
  label: 'strategyLabel',
  placeholder: 'strategyPlaceholder',
  altText: 'strategyAltText',
  title: 'strategyTitle',
  text: 'strategyText',
  css: 'strategyCss',
};

function breakable(value: string): string {
  return value.replace(/([/>])/g, '$1​');
}

// ? the first class of each entry is a hook for code and tests; the rest are @kostad/brand classes
const CLS = {
  panel:
    'panel kd-pos-fixed kd-d-flex kd-flex-column kd-overflow-hidden kd-bg-elevated kd-text-primary kd-border-1 kd-radius-lg kd-shadow-md kd-font-secondary kd-fs-xxs kd-lh-lg kd-pointer-none',
  head: 'head kd-d-flex kd-items-center kd-gap-2 kd-px-3 kd-py-2 kd-bg-surface kd-border-b-1',
  summary:
    'summary kd-grow-1 kd-min-w-0 kd-font-mono kd-fs-xs kd-fw-semibold kd-text-ellipsis',
  dims: 'dims kd-chip kd-chip--accent kd-chip--pill kd-shrink-0 kd-font-mono kd-fs-xxxs',
  pin: 'pin kd-shrink-0 kd-fs-micro kd-fw-semibold kd-text-uppercase kd-text-accent',
  body: 'body kd-overflow-y-auto',
  section: 'section kd-px-3 kd-py-2 kd-border-b-1',
  sectionTitle:
    'section-title kd-d-flex kd-items-center kd-justify-between kd-mb-2 kd-fs-micro kd-fw-bold kd-text-uppercase kd-text-accent',
  hint: 'hint kd-fw-medium kd-text-none kd-text-muted',
  subhead:
    'subhead kd-mt-2 kd-mb-1 kd-fs-micro kd-fw-bold kd-text-uppercase kd-text-muted',
  row: 'row',
  rowWide: 'row wide',
  key: 'key kd-fs-xxxs kd-fw-medium kd-text-muted kd-whitespace-nowrap',
  val: 'val kd-min-w-0 kd-font-mono kd-fs-xxxs kd-text-primary kd-break-break-all',
  valMuted:
    'val kd-min-w-0 kd-font-mono kd-fs-xxxs kd-text-muted kd-break-break-all',
  muted: 'muted kd-text-muted',
  source:
    'source kd-d-block kd-font-mono kd-fs-micro kd-text-muted kd-text-ellipsis',
  swatch: 'swatch kd-d-inline-block kd-radius-sm kd-border-1 kd-mr-1',
  badge: 'badge kd-chip kd-chip--pill kd-fs-micro kd-fw-regular kd-ml-1',
  unique: 'badge kd-status-pill kd-status-pill--active kd-fw-regular kd-ml-1',
  matches: 'badge kd-status-pill kd-status-pill--warning kd-fw-regular kd-ml-1',
  copy: 'copy kd-btn kd-btn--ghost kd-btn--sm kd-shrink-0 kd-px-2 kd-py-1 kd-fs-micro',
  revert:
    'copy revert kd-btn kd-btn--outline kd-btn--sm kd-shrink-0 kd-px-2 kd-py-1 kd-fs-micro',
  remove: 'copy remove kd-btn kd-btn--danger kd-btn--sm kd-px-2 kd-py-1',
  add: 'editable add kd-btn kd-btn--ghost kd-btn--sm kd-border-dashed kd-px-2 kd-py-1 kd-fs-micro',
  adderRow: 'kd-d-flex kd-py-1',
  kbd: 'kd-d-inline-block kd-px-1 kd-mr-1 kd-radius-sm kd-bg-elevated-hover kd-font-mono kd-fs-micro kd-fw-semibold kd-text-secondary',
  boxModel: 'box-model kd-mt-2 kd-font-mono kd-fs-xxxs kd-fw-medium',
  cell: 'cell kd-card kd-card--surface',
  cellLabel:
    'label kd-d-block kd-mb-1 kd-fs-micro kd-fw-regular kd-text-uppercase',
  editable: 'editable kd-d-inline-block kd-max-w-100',
  editableLive:
    'editable kd-d-inline-block kd-max-w-100 kd-cursor-text kd-radius-sm kd-transition-fast',
  edit: 'edit kd-field__input kd-w-100 kd-font-mono kd-fs-xxxs kd-py-1 kd-px-2',
  crumbs: 'crumbs kd-d-flex kd-flex-wrap kd-font-mono kd-fs-xxxs',
  sep: 'sep kd-text-muted kd-mx-1',
  current: 'current kd-text-bright kd-fw-semibold',
  foot: 'foot kd-d-flex kd-flex-wrap kd-gap-2 kd-px-3 kd-py-2 kd-bg-surface kd-border-t-1 kd-fs-micro kd-fw-medium kd-text-muted',
};

const CELL_TONE: Record<string, string> = {
  m: 'kd-text-warning',
  p: 'kd-text-accent',
  b: 'kd-text-secondary',
  // ? the brand has no purple text class; kw is the panel's own --kd-code-control colour
  g: 'kw',
};

type Child = Node | string | null | undefined | false;

function h(
  tag: string,
  attrs: Record<string, string> = {},
  ...children: Child[]
): HTMLElement {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name === 'class') node.className = value;
    else node.setAttribute(name, value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

// ? code and page text keep their own direction inside a right-to-left panel
function code(...children: Child[]): HTMLElement {
  return h('bdi', {}, ...children);
}

export class Panel {
  private readonly element: HTMLDivElement;
  private readonly head: HTMLElement;
  private readonly body: HTMLElement;
  private readonly foot: HTMLElement;
  private pinned = false;
  private allowEdit = true;
  private hasSource = false;
  private drag: { dx: number; dy: number } | null = null;
  private readonly editables = new WeakMap<HTMLElement, Editable>();
  private editor: Editor | null = null;
  private pending: [ElementInfo, LensSettings, RenderOptions] | null = null;

  constructor(
    root: ParentNode,
    private readonly handlers: PanelHandlers,
  ) {
    this.element = document.createElement('div');
    this.element.className = CLS.panel;
    this.element.hidden = true;
    // ? the closed shadow tree never sees the page's dir, so the panel carries the UI language's own
    this.element.lang = uiLanguage();
    this.element.dir = textDirection();
    this.head = h('div', { class: CLS.head });
    this.body = h('div', { class: CLS.body });
    this.foot = h('div', { class: CLS.foot });
    this.element.append(this.head, this.body, this.foot);
    this.element.addEventListener('click', (event) => {
      this.onClick(event);
    });
    this.bindDrag();
    root.appendChild(this.element);
    this.renderFoot();
  }

  private get canEdit(): boolean {
    return this.pinned && this.allowEdit;
  }

  get editing(): boolean {
    return this.editor !== null;
  }

  private onClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const editable = target.closest<HTMLElement>('.editable');
    const button = target.closest<HTMLElement>('[data-action]');
    if (!editable && !button) return;
    event.preventDefault();
    event.stopPropagation();
    if (editable) {
      const entry = this.editables.get(editable);
      if (entry && this.canEdit) this.edit(editable, entry);
      return;
    }
    const id = button?.dataset.action;
    if (id === 'open') {
      this.handlers.open();
      return;
    }
    if (id === 'revert') {
      this.handlers.revert();
      return;
    }
    if (id === 'remove' && button) {
      const entry = this.editables.get(button);
      if (entry) this.handlers.write(entry.field, null);
      return;
    }
    const action = COPY_ACTIONS.find((a) => a.id === id);
    if (action) this.handlers.copy(action);
  }

  private edit(target: HTMLElement, entry: Editable): void {
    if (this.editor) return;
    const fresh =
      entry.field.kind === 'new-style' || entry.field.kind === 'new-attribute';
    const initial = fresh ? '' : this.handlers.read(entry.field);
    const input = h('input', {
      class: CLS.edit,
      type: 'text',
      spellcheck: 'false',
      autocomplete: 'off',
      placeholder: entry.placeholder,
      'aria-label': entry.placeholder || t('editValue'),
    }) as HTMLInputElement;
    input.value = initial;
    this.editor = { ...entry, input, target, initial };
    const stop = (event: Event) => {
      event.stopPropagation();
    };
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        this.commit(false);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.close();
      }
    });
    input.addEventListener('keyup', stop);
    input.addEventListener('keypress', stop);
    input.addEventListener('input', () => {
      input.classList.remove('invalid', 'kd-invalid');
      input.removeAttribute('aria-invalid');
    });
    input.addEventListener('blur', () => {
      if (this.editor?.input === input) this.commit(true);
    });
    target.replaceWith(input);
    input.focus();
    input.select();
  }

  private commit(leaving: boolean): void {
    const editor = this.editor;
    if (!editor) return;
    const value = editor.input.value;
    if (value === editor.initial || this.handlers.write(editor.field, value)) {
      this.close();
      return;
    }
    if (leaving) {
      this.close();
      return;
    }
    editor.input.classList.add('invalid', 'kd-invalid');
    editor.input.setAttribute('aria-invalid', 'true');
  }

  private close(): void {
    const editor = this.editor;
    if (!editor) return;
    this.editor = null;
    const pending = this.pending;
    this.pending = null;
    if (pending) {
      this.render(...pending);
    } else if (editor.input.isConnected) {
      editor.input.replaceWith(editor.target);
    }
  }

  private editable(
    display: Child,
    field: EditField,
    placeholder = '',
  ): HTMLElement {
    const node = h(
      'span',
      { class: this.canEdit ? CLS.editableLive : CLS.editable },
      display,
    );
    this.editables.set(node, { field, placeholder });
    return node;
  }

  private adder(label: string, field: EditField, placeholder: string): Child {
    if (!this.canEdit) return null;
    const button = h('button', { class: CLS.add, type: 'button' }, label);
    this.editables.set(button, { field, placeholder });
    return h('div', { class: CLS.adderRow }, button);
  }

  private remover(name: string): Child {
    if (!this.canEdit) return h('span');
    const button = h(
      'button',
      {
        class: CLS.remove,
        type: 'button',
        'data-action': 'remove',
        title: t('panelRemoveAttribute', [name]),
      },
      '×',
    );
    this.editables.set(button, {
      field: { kind: 'attribute', name },
      placeholder: '',
    });
    return button;
  }

  private bindDrag(): void {
    this.head.addEventListener('pointerdown', (event) => {
      if (!this.pinned || event.button !== 0) return;
      if ((event.target as HTMLElement).closest('[data-action]')) return;
      event.preventDefault();
      const rect = this.element.getBoundingClientRect();
      this.drag = {
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top,
      };
      this.element.classList.add('dragging');
      if (typeof this.head.setPointerCapture === 'function') {
        this.head.setPointerCapture(event.pointerId);
      }
    });
    this.head.addEventListener('pointermove', (event) => {
      if (!this.drag) return;
      this.place(event.clientX - this.drag.dx, event.clientY - this.drag.dy);
    });
    const end = () => {
      this.drag = null;
      this.element.classList.remove('dragging');
    };
    this.head.addEventListener('pointerup', end);
    this.head.addEventListener('pointercancel', end);
  }

  get visible(): boolean {
    return !this.element.hidden;
  }

  show(): void {
    this.element.hidden = false;
  }

  hide(): void {
    this.editor = null;
    this.pending = null;
    this.element.hidden = true;
  }

  setPinned(pinned: boolean): void {
    this.pinned = pinned;
    this.element.classList.toggle('pinned', pinned);
    this.element.classList.toggle('can-edit', this.canEdit);
    this.renderFoot();
  }

  // ? beside the inspected element when a side has room for the whole panel, so it never hides it; otherwise beside the pointer
  position(x: number, y: number, avoid?: DOMRect): void {
    this.element.style.removeProperty('--room');
    if (avoid && this.besideElement(x, y, avoid)) return;

    const { innerWidth, innerHeight } = window;
    const width = this.element.offsetWidth || 360;
    const right = x + OFFSET;
    const left = x - OFFSET - width;
    const fitsRight = right + width + EDGE <= innerWidth;

    if (fitsRight || left >= EDGE) {
      const height = this.element.offsetHeight || 300;
      let top = y + OFFSET;
      if (top + height + EDGE > innerHeight) top = y - OFFSET - height;
      this.place(fitsRight ? right : left, top);
      return;
    }

    // ? no room beside the pointer: sit above or below it and shrink to that space
    const below = innerHeight - y - OFFSET - EDGE;
    const above = y - OFFSET - EDGE;
    const room = Math.floor(Math.max(below, above));
    this.element.style.setProperty('--room', `${room.toString()}px`);
    const height = this.element.offsetHeight || 300;
    this.place(
      x - width / 2,
      below >= above ? y + OFFSET : y - OFFSET - height,
    );
  }

  // ? right, left, below, then above the element; the side spots keep the head level with the pointer
  private besideElement(x: number, y: number, avoid: DOMRect): boolean {
    const { innerWidth, innerHeight } = window;
    const width = this.element.offsetWidth || 360;
    const height = this.element.offsetHeight || 300;
    const spots: [fits: boolean, left: number, top: number][] = [
      [
        avoid.right + OFFSET + width + EDGE <= innerWidth,
        avoid.right + OFFSET,
        y - OFFSET,
      ],
      [
        avoid.left - OFFSET - width >= EDGE,
        avoid.left - OFFSET - width,
        y - OFFSET,
      ],
      [
        avoid.bottom + OFFSET + height + EDGE <= innerHeight,
        x - width / 2,
        avoid.bottom + OFFSET,
      ],
      [
        avoid.top - OFFSET - height >= EDGE,
        x - width / 2,
        avoid.top - OFFSET - height,
      ],
    ];
    const spot = spots.find(([fits]) => fits);
    if (!spot) return false;
    this.place(spot[1], spot[2]);
    return true;
  }

  private place(left: number, top: number): void {
    const { innerWidth, innerHeight } = window;
    const width = this.element.offsetWidth || 360;
    const height = this.element.offsetHeight || 300;
    const x = Math.max(EDGE, Math.min(left, innerWidth - width - EDGE));
    const y = Math.max(EDGE, Math.min(top, innerHeight - height - EDGE));
    this.element.style.left = `${Math.round(x).toString()}px`;
    this.element.style.top = `${Math.round(y).toString()}px`;
  }

  flash(action: CopyAction): void {
    const buttons = this.element.querySelectorAll<HTMLElement>(
      `[data-action="${action.id}"]`,
    );
    for (const button of Array.from(buttons)) {
      button.classList.add('done');
      setTimeout(() => {
        button.classList.remove('done');
      }, 900);
    }
  }

  render(
    info: ElementInfo,
    settings: LensSettings,
    options: RenderOptions = {},
  ): void {
    if (this.editor) {
      this.pending = [info, settings, options];
      return;
    }
    if (this.allowEdit !== settings.allowEdit) {
      this.allowEdit = settings.allowEdit;
      this.element.classList.toggle('can-edit', this.canEdit);
      this.renderFoot();
    }
    const head = h(
      'div',
      {},
      h('span', { class: CLS.summary }, code(...this.summary(info))),
      h(
        'span',
        { class: CLS.dims },
        code(`${info.box.width.toString()} × ${info.box.height.toString()}`),
      ),
      options.edited
        ? h(
            'button',
            {
              class: CLS.revert,
              type: 'button',
              'data-action': 'revert',
              title: t('panelResetTitle'),
            },
            t('panelReset'),
          )
        : null,
      this.pinned ? h('span', { class: CLS.pin }, t('panelPinned')) : null,
    );
    this.head.replaceChildren(...Array.from(head.childNodes));

    const sections: Child[] = [];
    if (settings.showBox) sections.push(this.box(info));
    if (settings.showEvents) sections.push(this.events(info));
    if (settings.showStyles) sections.push(this.styles(info.styles));
    if (settings.showAccessibility) sections.push(this.accessibility(info));
    if (settings.showAttributes && (info.attributes.length || this.canEdit)) {
      sections.push(this.attributes(info));
    }
    if (settings.showMedia && info.media) sections.push(this.media(info));
    if (settings.showContext) sections.push(this.context(info));
    if (settings.showSelectors) sections.push(this.selectors(info));

    const scroll = this.body.scrollTop;
    this.body.replaceChildren(...sections.filter((s): s is Node => !!s));
    this.body.scrollTop = options.keepScroll ? scroll : 0;
    if (this.hasSource !== Boolean(info.source)) {
      this.hasSource = Boolean(info.source);
      this.renderFoot();
    }
  }

  private summary(info: ElementInfo): Child[] {
    const parts: Child[] = [h('span', { class: 'tag' }, info.tag)];
    if (info.id) parts.push(h('span', { class: 'id' }, `#${info.id}`));
    for (const name of info.classes.slice(0, 3)) {
      parts.push(h('span', { class: 'class' }, `.${name}`));
    }
    if (info.classes.length > 3) {
      parts.push(
        h(
          'span',
          { class: CLS.muted },
          ` +${(info.classes.length - 3).toString()}`,
        ),
      );
    }
    return parts;
  }

  private section(title: string, hint: string, ...rows: Child[]): HTMLElement {
    return h(
      'div',
      { class: CLS.section },
      h(
        'div',
        { class: CLS.sectionTitle },
        h('span', {}, title),
        hint ? h('span', { class: CLS.hint }, hint) : null,
      ),
      ...rows,
    );
  }

  private copyButton(action: CopyAction): HTMLElement {
    return h(
      'button',
      { class: CLS.copy, type: 'button', 'data-action': action.id },
      h('kbd', { class: CLS.kbd }, action.key),
      t('panelCopy'),
    );
  }

  private row(key: string, value: Child, extra?: Child): HTMLElement {
    return h(
      'div',
      { class: CLS.row },
      h('span', { class: CLS.key }, key),
      h('span', { class: CLS.val }, code(value)),
      extra ?? h('span'),
    );
  }

  private action(id: CopyAction['id']): CopyAction {
    return COPY_ACTIONS.find((a) => a.id === id) ?? COPY_ACTIONS[0];
  }

  private selectors(info: ElementInfo): HTMLElement {
    const best = bestLocator(info.locators);
    const rows: Child[] = [
      this.row(
        'CSS',
        breakable(info.selector),
        this.copyButton(this.action('selector')),
      ),
      this.row(
        'XPath',
        breakable(info.xpath),
        this.copyButton(this.action('xpath')),
      ),
      h('div', { class: CLS.subhead }, 'Playwright'),
    ];

    for (const locator of info.locators) {
      rows.push(this.locatorRow(locator, locator === best));
    }

    return this.section(
      t('sectionSelectors'),
      info.shadowHost ? t('shadowHostHint', [info.shadowHost]) : '',
      ...rows,
    );
  }

  private locatorRow(locator: Locator, isBest: boolean): HTMLElement {
    const unique = locator.matches === 1;
    const badge = h(
      'span',
      { class: unique ? CLS.unique : CLS.matches },
      unique ? t('locatorUnique') : plural('locatorMatches', locator.matches),
    );
    return h(
      'div',
      { class: CLS.row },
      h('span', { class: CLS.key }, t(STRATEGY_KEYS[locator.strategy])),
      h('span', { class: CLS.val }, code(breakable(locator.code)), badge),
      isBest ? this.copyButton(this.action('locator')) : h('span'),
    );
  }

  private events(info: ElementInfo): HTMLElement {
    const { listeners } = info.events;
    const count = listeners.length;
    const hint = count ? plural('listeners', count) : '';

    if (!listeners.length) {
      return this.section(
        t('sectionEvents'),
        hint,
        h(
          'div',
          { class: CLS.rowWide },
          h('span', { class: CLS.valMuted }, t('noListeners')),
          h('span'),
        ),
      );
    }

    const rows = listeners.map((listener) =>
      h(
        'div',
        { class: CLS.row },
        h('span', { class: CLS.key }, listener.type),
        h(
          'span',
          { class: CLS.val },
          listener.name
            ? code(h('span', { class: 'kw' }, listener.name))
            : h('span', { class: CLS.muted }, t('eventAnonymous')),
          listener.origin !== 'listener'
            ? h(
                'span',
                { class: CLS.badge },
                listener.origin === 'inline'
                  ? t('eventOriginInline')
                  : listener.origin,
              )
            : null,
          ...listener.flags.map((flag) =>
            h('span', { class: CLS.badge }, flag),
          ),
          listener.source
            ? h(
                'span',
                { class: CLS.source },
                code(truncate(listener.source, 110)),
              )
            : null,
        ),
        h('span'),
      ),
    );

    return this.section(t('sectionEvents'), hint, ...rows);
  }

  private box(info: ElementInfo): HTMLElement {
    const { box } = info;
    const cell = (
      name: string,
      cls: string,
      property: string,
      value: string,
      placeholder: string,
    ) =>
      h(
        'div',
        { class: `${CLS.cell} ${cls}` },
        h('span', { class: `${CLS.cellLabel} ${CELL_TONE[cls] ?? ''}` }, name),
        this.editable(
          code(value),
          { kind: 'style', property, lengths: true },
          placeholder,
        ),
      );
    const edges = (
      name: string,
      cls: string,
      property: string,
      e: typeof box.margin,
    ) =>
      cell(
        name,
        cls,
        property,
        `${e.top.toString()} ${e.right.toString()} ${e.bottom.toString()} ${e.left.toString()}`,
        t('boxEdgesPlaceholder', [name]),
      );
    const length = (property: string, value: number) =>
      this.editable(
        h('span', { class: 'num' }, value.toString()),
        { kind: 'style', property, lengths: true },
        property,
      );

    return this.section(
      t('sectionBox'),
      t('boxHint'),
      this.row(
        t('rowPosition'),
        h(
          'span',
          {},
          h('span', { class: 'num' }, box.x.toString()),
          ', ',
          h('span', { class: 'num' }, box.y.toString()),
        ),
      ),
      this.row(
        t('rowSize'),
        h(
          'span',
          {},
          length('width', box.width),
          ' × ',
          length('height', box.height),
        ),
      ),
      h(
        'div',
        { class: CLS.boxModel },
        edges('margin', 'm', 'margin', box.margin),
        edges('padding', 'p', 'padding', box.padding),
        edges('border', 'b', 'border-width', box.border),
        box.gap &&
          cell(
            'gap',
            'g',
            'gap',
            `${box.gap.row.toString()} ${box.gap.column.toString()}`,
            t('boxGapPlaceholder'),
          ),
      ),
    );
  }

  private styles(styles: StyleEntry[]): HTMLElement {
    return this.section(
      t('sectionStyles'),
      t('stylesHint'),
      ...styles.map((style) =>
        this.row(
          style.property,
          this.editable(
            h(
              'span',
              {},
              style.color
                ? h('span', {
                    class: CLS.swatch,
                    style: `background:${style.color}`,
                  })
                : null,
              truncate(style.value, 90),
            ),
            { kind: 'style', property: style.property },
            style.property,
          ),
        ),
      ),
      this.adder(
        t('addStyle'),
        { kind: 'new-style' },
        t('addStylePlaceholder'),
      ),
    );
  }

  private accessibility(info: ElementInfo): HTMLElement {
    const { accessibility } = info;
    const rows: Child[] = [
      this.row(
        t('rowRole'),
        this.editable(
          accessibility.role
            ? h('span', { class: 'kw' }, accessibility.role)
            : h('span', { class: CLS.muted }, 'generic'),
          { kind: 'attribute', name: 'role' },
          accessibility.role || 'role',
        ),
      ),
      this.row(
        t('rowName'),
        this.editable(
          accessibility.name
            ? truncate(accessibility.name, 90)
            : h('span', { class: CLS.muted }, t('valueNone')),
          { kind: 'attribute', name: 'aria-label' },
          accessibility.name || 'aria-label',
        ),
      ),
      this.row(
        t('rowFocusable'),
        h(
          'span',
          {},
          accessibility.focusable ? t('valueYes') : t('valueNo'),
          accessibility.tabIndex !== null
            ? h(
                'span',
                { class: CLS.muted },
                ` · tabindex ${accessibility.tabIndex.toString()}`,
              )
            : null,
        ),
      ),
    ];
    for (const attr of accessibility.aria) {
      rows.push(
        h(
          'div',
          { class: CLS.rowWide },
          h(
            'span',
            { class: CLS.val },
            code(
              h('span', { class: 'attr' }, attr.name),
              '=',
              this.editable(
                h('span', { class: 'value' }, `"${attr.value}"`),
                { kind: 'attribute', name: attr.name },
                attr.name,
              ),
            ),
          ),
          h('span'),
        ),
      );
    }
    return this.section(t('sectionAccessibility'), '', ...rows);
  }

  private attributes(info: ElementInfo): HTMLElement {
    const shown = info.attributes.slice(0, 12);
    const rows: Child[] = shown.map((attr) =>
      h(
        'div',
        { class: CLS.rowWide },
        h(
          'span',
          { class: CLS.val },
          code(
            h('span', { class: 'attr' }, attr.name),
            '=',
            this.editable(
              attr.value
                ? h('span', { class: 'value' }, `"${attr.value}"`)
                : h('span', { class: CLS.muted }, '""'),
              { kind: 'attribute', name: attr.name },
              attr.name,
            ),
          ),
        ),
        this.remover(attr.name),
      ),
    );
    rows.push(
      this.adder(
        t('addAttribute'),
        { kind: 'new-attribute' },
        t('addAttributePlaceholder'),
      ),
    );
    const hidden = info.attributes.length - shown.length;
    return this.section(
      t('sectionAttributes'),
      hidden > 0 ? plural('attributesMore', hidden) : '',
      ...rows,
    );
  }

  private context(info: ElementInfo): HTMLElement {
    const crumbs = h('div', { class: CLS.crumbs });
    const separator = textDirection() === 'rtl' ? '‹' : '›';
    for (const ancestor of [...info.ancestors].reverse()) {
      crumbs.append(
        h('span', { class: CLS.muted }, code(ancestor.summary)),
        h('span', { class: CLS.sep }, separator),
      );
    }
    crumbs.append(h('span', { class: CLS.current }, code(info.summary)));
    const { framework } = info.events;

    return this.section(
      t('sectionContext'),
      plural('children', info.childCount),
      info.source
        ? this.row(
            t('rowSource'),
            h(
              'span',
              {},
              breakable(formatSource(info.source)),
              h('span', { class: CLS.badge }, info.source.origin),
            ),
            info.devServer
              ? h(
                  'button',
                  { class: CLS.copy, type: 'button', 'data-action': 'open' },
                  h('kbd', { class: CLS.kbd }, 'O'),
                  t('panelOpen'),
                )
              : undefined,
          )
        : null,
      framework
        ? this.row(
            t('rowFramework'),
            h('span', { class: 'kw' }, framework.name),
          )
        : null,
      framework?.component
        ? this.row(t('rowComponent'), framework.component)
        : null,
      crumbs,
      this.textRow(info),
    );
  }

  private textRow(info: ElementInfo): Child {
    const leaf = info.childCount === 0;
    if (!info.text && !(leaf && this.canEdit)) return null;
    const display = h(
      'span',
      { class: CLS.muted },
      info.text ? truncate(info.text, 120) : t('valueEmpty'),
    );
    return this.row(
      t('rowText'),
      leaf ? this.editable(display, { kind: 'text' }, 'text') : display,
    );
  }

  private media(info: ElementInfo): HTMLElement {
    const media = info.media;
    if (!media) return h('div');
    const rows: Child[] = [this.row(t('rowKind'), media.kind)];
    const sourceAttribute =
      media.kind === 'svg' ? 'viewBox' : media.kind === 'canvas' ? null : 'src';
    if (media.source || (sourceAttribute && this.canEdit)) {
      const display = media.source
        ? truncate(media.source, 160)
        : h('span', { class: CLS.muted }, t('valueNone'));
      rows.push(
        this.row(
          t('rowSource'),
          sourceAttribute
            ? this.editable(
                display,
                { kind: 'attribute', name: sourceAttribute },
                sourceAttribute,
              )
            : display,
        ),
      );
    }
    if (media.naturalWidth !== undefined && media.naturalHeight !== undefined) {
      rows.push(
        this.row(
          t('rowNatural'),
          `${media.naturalWidth.toString()} × ${media.naturalHeight.toString()}`,
        ),
      );
    }
    if (media.duration !== undefined) {
      rows.push(
        this.row(
          t('rowDuration'),
          Number.isFinite(media.duration)
            ? formatDuration(media.duration)
            : t('mediaLive'),
        ),
      );
    }
    if (media.alt !== undefined)
      rows.push(
        this.row(
          t('rowAlt'),
          this.editable(
            media.alt || h('span', { class: CLS.muted }, t('valueEmpty')),
            { kind: 'attribute', name: 'alt' },
            'alt',
          ),
        ),
      );
    return this.section(t('sectionMedia'), '', ...rows);
  }

  private renderFoot(): void {
    const hints: Child[] = [
      h(
        'span',
        {},
        h('kbd', { class: CLS.kbd }, t('kbdClick')),
        this.pinned ? t('footUnpin') : t('footPin'),
      ),
      this.pinned
        ? h(
            'span',
            {},
            h('kbd', { class: CLS.kbd }, t('kbdDrag')),
            t('footMove'),
          )
        : null,
      this.canEdit
        ? h(
            'span',
            {},
            h('kbd', { class: CLS.kbd }, t('kbdClickValue')),
            t('footEdit'),
          )
        : null,
      h('span', {}, h('kbd', { class: CLS.kbd }, 'esc'), t('footClose')),
      h(
        'span',
        {},
        h('kbd', { class: CLS.kbd }, '↑'),
        h('kbd', { class: CLS.kbd }, '↓'),
        t('footParentChild'),
      ),
      h(
        'span',
        {},
        h('kbd', { class: CLS.kbd }, '←'),
        h('kbd', { class: CLS.kbd }, '→'),
        t('footSibling'),
      ),
      this.hasSource
        ? h('span', {}, h('kbd', { class: CLS.kbd }, 'O'), t('footOpenSource'))
        : null,
      ...COPY_ACTIONS.map((action) =>
        h(
          'span',
          {},
          h('kbd', { class: CLS.kbd }, action.key),
          t(action.labelKey),
        ),
      ),
    ];
    this.foot.replaceChildren(...hints.filter((x): x is Node => !!x));
  }
}
