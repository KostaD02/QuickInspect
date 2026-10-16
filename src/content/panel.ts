import { ElementInfo, LensSettings, Locator, StyleEntry } from '@/shared/types';
import {
  bestLocator,
  formatDuration,
  formatSource,
  STRATEGY_LABELS,
  truncate,
} from '@/shared/util';
import { COPY_ACTIONS, CopyAction } from './actions';
import { EditField } from './edits';

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

function breakable(value: string): string {
  return value.replace(/([/>])/g, '$1\u200B');
}

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
    this.element.className = 'panel';
    this.element.hidden = true;
    this.head = h('div', { class: 'head' });
    this.body = h('div', { class: 'body' });
    this.foot = h('div', { class: 'foot' });
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
      class: 'edit',
      type: 'text',
      spellcheck: 'false',
      autocomplete: 'off',
      placeholder: entry.placeholder,
      'aria-label': entry.placeholder || 'value',
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
      input.classList.remove('invalid');
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
    editor.input.classList.add('invalid');
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
    const node = h('span', { class: 'editable' }, display);
    this.editables.set(node, { field, placeholder });
    return node;
  }

  private adder(label: string, field: EditField, placeholder: string): Child {
    if (!this.canEdit) return null;
    const button = h(
      'button',
      { class: 'editable add', type: 'button' },
      label,
    );
    this.editables.set(button, { field, placeholder });
    return h('div', { class: 'row wide' }, button, h('span'));
  }

  private remover(name: string): Child {
    if (!this.canEdit) return h('span');
    const button = h(
      'button',
      {
        class: 'copy remove',
        type: 'button',
        'data-action': 'remove',
        title: `Remove ${name}`,
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

  position(x: number, y: number): void {
    const { innerWidth, innerHeight } = window;
    const width = this.element.offsetWidth || 360;
    const height = this.element.offsetHeight || 300;

    let left = x + OFFSET;
    let top = y + OFFSET;

    if (left + width + EDGE > innerWidth) left = x - OFFSET - width;
    if (top + height + EDGE > innerHeight) top = y - OFFSET - height;

    this.place(left, top);
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
      h('span', { class: 'summary' }, ...this.summary(info)),
      h(
        'span',
        { class: 'dims' },
        `${info.box.width.toString()} × ${info.box.height.toString()}`,
      ),
      options.edited
        ? h(
            'button',
            {
              class: 'copy revert',
              type: 'button',
              'data-action': 'revert',
              title: 'Undo every edit on this element',
            },
            'reset',
          )
        : null,
      this.pinned ? h('span', { class: 'pin' }, 'pinned') : null,
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
          { class: 'muted' },
          ` +${(info.classes.length - 3).toString()}`,
        ),
      );
    }
    return parts;
  }

  private section(title: string, hint: string, ...rows: Child[]): HTMLElement {
    return h(
      'div',
      { class: 'section' },
      h(
        'div',
        { class: 'section-title' },
        h('span', {}, title),
        hint ? h('span', { class: 'hint' }, hint) : null,
      ),
      ...rows,
    );
  }

  private copyButton(action: CopyAction): HTMLElement {
    return h(
      'button',
      { class: 'copy', type: 'button', 'data-action': action.id },
      h('kbd', {}, action.key),
      'copy',
    );
  }

  private row(key: string, value: Child, extra?: Child): HTMLElement {
    return h(
      'div',
      { class: 'row' },
      h('span', { class: 'key' }, key),
      h('span', { class: 'val' }, value),
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
      h('div', { class: 'subhead' }, 'Playwright'),
    ];

    for (const locator of info.locators) {
      rows.push(this.locatorRow(locator, locator === best));
    }

    return this.section(
      'Selectors',
      info.shadowHost ? `inside shadow root of ${info.shadowHost}` : '',
      ...rows,
    );
  }

  private locatorRow(locator: Locator, isBest: boolean): HTMLElement {
    const unique = locator.matches === 1;
    const badge = h(
      'span',
      { class: `badge ${unique ? 'ok' : 'warn'}` },
      unique ? 'unique' : `${locator.matches.toString()} matches`,
    );
    return h(
      'div',
      { class: 'row' },
      h('span', { class: 'key' }, STRATEGY_LABELS[locator.strategy]),
      h('span', { class: 'val' }, breakable(locator.code), badge),
      isBest ? this.copyButton(this.action('locator')) : h('span'),
    );
  }

  private events(info: ElementInfo): HTMLElement {
    const { listeners, framework } = info.events;
    const hint = framework
      ? `${framework.name}${framework.component ? ` · ${framework.component}` : ''}`
      : listeners.length
        ? `${listeners.length.toString()} ${listeners.length === 1 ? 'listener' : 'listeners'}`
        : '';

    if (!listeners.length) {
      return this.section(
        'Events',
        hint,
        h(
          'div',
          { class: 'row wide' },
          h('span', { class: 'val muted' }, 'no listeners on this element'),
          h('span'),
        ),
      );
    }

    const rows = listeners.map((listener) =>
      h(
        'div',
        { class: 'row' },
        h('span', { class: 'key' }, listener.type),
        h(
          'span',
          { class: 'val' },
          h('span', { class: 'kw' }, listener.name),
          listener.origin !== 'listener'
            ? h('span', { class: 'badge' }, listener.origin)
            : null,
          ...listener.flags.map((flag) => h('span', { class: 'badge' }, flag)),
          listener.source
            ? h(
                'span',
                { class: 'source muted' },
                truncate(listener.source, 110),
              )
            : null,
        ),
        h('span'),
      ),
    );

    return this.section('Events', hint, ...rows);
  }

  private box(info: ElementInfo): HTMLElement {
    const { box } = info;
    const edges = (
      name: string,
      cls: string,
      property: string,
      e: typeof box.margin,
    ) =>
      h(
        'div',
        { class: `cell ${cls}` },
        h('span', { class: 'label' }, name),
        this.editable(
          `${e.top.toString()} ${e.right.toString()} ${e.bottom.toString()} ${e.left.toString()}`,
          { kind: 'style', property, lengths: true },
          `${name}: top right bottom left`,
        ),
      );
    const length = (property: string, value: number) =>
      this.editable(
        h('span', { class: 'num' }, value.toString()),
        { kind: 'style', property, lengths: true },
        property,
      );

    return this.section(
      'Box',
      'top right bottom left',
      this.row(
        'Position',
        h(
          'span',
          {},
          h('span', { class: 'num' }, box.x.toString()),
          ', ',
          h('span', { class: 'num' }, box.y.toString()),
        ),
      ),
      this.row(
        'Size',
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
        { class: 'box-model' },
        edges('margin', 'm', 'margin', box.margin),
        edges('padding', 'p', 'padding', box.padding),
        edges('border', 'b', 'border-width', box.border),
      ),
    );
  }

  private styles(styles: StyleEntry[]): HTMLElement {
    return this.section(
      'Styles',
      'computed',
      ...styles.map((style) =>
        this.row(
          style.property,
          this.editable(
            h(
              'span',
              {},
              style.color
                ? h('span', {
                    class: 'swatch',
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
      this.adder('+ style', { kind: 'new-style' }, 'property: value'),
    );
  }

  private accessibility(info: ElementInfo): HTMLElement {
    const { accessibility } = info;
    const rows: Child[] = [
      this.row(
        'Role',
        this.editable(
          accessibility.role
            ? h('span', { class: 'kw' }, accessibility.role)
            : h('span', { class: 'muted' }, 'generic'),
          { kind: 'attribute', name: 'role' },
          accessibility.role || 'role',
        ),
      ),
      this.row(
        'Name',
        this.editable(
          accessibility.name
            ? truncate(accessibility.name, 90)
            : h('span', { class: 'muted' }, 'none'),
          { kind: 'attribute', name: 'aria-label' },
          accessibility.name || 'aria-label',
        ),
      ),
      this.row(
        'Focusable',
        h(
          'span',
          {},
          accessibility.focusable ? 'yes' : 'no',
          accessibility.tabIndex !== null
            ? h(
                'span',
                { class: 'muted' },
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
          { class: 'row wide' },
          h(
            'span',
            { class: 'val' },
            h('span', { class: 'attr' }, attr.name),
            '=',
            this.editable(
              h('span', { class: 'value' }, `"${attr.value}"`),
              { kind: 'attribute', name: attr.name },
              attr.name,
            ),
          ),
          h('span'),
        ),
      );
    }
    return this.section('Accessibility', '', ...rows);
  }

  private attributes(info: ElementInfo): HTMLElement {
    const shown = info.attributes.slice(0, 12);
    const rows: Child[] = shown.map((attr) =>
      h(
        'div',
        { class: 'row wide' },
        h(
          'span',
          { class: 'val' },
          h('span', { class: 'attr' }, attr.name),
          '=',
          this.editable(
            attr.value
              ? h('span', { class: 'value' }, `"${attr.value}"`)
              : h('span', { class: 'muted' }, '""'),
            { kind: 'attribute', name: attr.name },
            attr.name,
          ),
        ),
        this.remover(attr.name),
      ),
    );
    rows.push(
      this.adder('+ attribute', { kind: 'new-attribute' }, 'name="value"'),
    );
    const hidden = info.attributes.length - shown.length;
    return this.section(
      'Attributes',
      hidden > 0 ? `+${hidden.toString()} more` : '',
      ...rows,
    );
  }

  private context(info: ElementInfo): HTMLElement {
    const crumbs = h('div', { class: 'crumbs' });
    for (const ancestor of [...info.ancestors].reverse()) {
      crumbs.append(
        h('span', { class: 'muted' }, ancestor.summary),
        h('span', { class: 'sep' }, '›'),
      );
    }
    crumbs.append(h('span', { class: 'current' }, info.summary));

    return this.section(
      'Context',
      `${info.childCount.toString()} ${info.childCount === 1 ? 'child' : 'children'}`,
      info.source
        ? this.row(
            'Source',
            h(
              'span',
              {},
              breakable(formatSource(info.source)),
              h('span', { class: 'badge' }, info.source.origin),
            ),
            info.devServer
              ? h(
                  'button',
                  { class: 'copy', type: 'button', 'data-action': 'open' },
                  h('kbd', {}, 'O'),
                  'open',
                )
              : undefined,
          )
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
      { class: 'muted' },
      info.text ? truncate(info.text, 120) : 'empty',
    );
    return this.row(
      'Text',
      leaf ? this.editable(display, { kind: 'text' }, 'text') : display,
    );
  }

  private media(info: ElementInfo): HTMLElement {
    const media = info.media;
    if (!media) return h('div');
    const rows: Child[] = [this.row('Kind', media.kind)];
    const sourceAttribute =
      media.kind === 'svg' ? 'viewBox' : media.kind === 'canvas' ? null : 'src';
    if (media.source || (sourceAttribute && this.canEdit)) {
      const display = media.source
        ? truncate(media.source, 160)
        : h('span', { class: 'muted' }, 'none');
      rows.push(
        this.row(
          'Source',
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
          'Natural',
          `${media.naturalWidth.toString()} × ${media.naturalHeight.toString()}`,
        ),
      );
    }
    if (media.duration !== undefined)
      rows.push(this.row('Duration', formatDuration(media.duration)));
    if (media.alt !== undefined)
      rows.push(
        this.row(
          'Alt',
          this.editable(
            media.alt || h('span', { class: 'muted' }, 'empty'),
            { kind: 'attribute', name: 'alt' },
            'alt',
          ),
        ),
      );
    return this.section('Media', '', ...rows);
  }

  private renderFoot(): void {
    const hints: Child[] = [
      h('span', {}, h('kbd', {}, 'click'), this.pinned ? 'unpin' : 'pin'),
      this.pinned ? h('span', {}, h('kbd', {}, 'drag'), 'move') : null,
      this.canEdit ? h('span', {}, h('kbd', {}, 'click value'), 'edit') : null,
      h('span', {}, h('kbd', {}, 'esc'), 'close'),
      h('span', {}, h('kbd', {}, '↑'), h('kbd', {}, '↓'), 'parent / child'),
      this.hasSource ? h('span', {}, h('kbd', {}, 'O'), 'open source') : null,
      ...COPY_ACTIONS.map((action) =>
        h('span', {}, h('kbd', {}, action.key), action.label),
      ),
    ];
    this.foot.replaceChildren(...hints.filter((x): x is Node => !!x));
  }
}
