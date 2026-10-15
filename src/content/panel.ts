import { ElementInfo, LensSettings, Locator, StyleEntry } from '@/shared/types';
import {
  bestLocator,
  formatDuration,
  formatSource,
  STRATEGY_LABELS,
  truncate,
} from '@/shared/util';
import { COPY_ACTIONS, CopyAction } from './actions';

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
  private hasSource = false;
  private drag: { dx: number; dy: number } | null = null;

  constructor(
    root: ParentNode,
    private readonly onCopy: (action: CopyAction) => void,
    private readonly onOpen: () => void,
  ) {
    this.element = document.createElement('div');
    this.element.className = 'panel';
    this.element.hidden = true;
    this.head = h('div', { class: 'head' });
    this.body = h('div', { class: 'body' });
    this.foot = h('div', { class: 'foot' });
    this.element.append(this.head, this.body, this.foot);
    this.element.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLElement>(
        '[data-action]',
      );
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      if (button.dataset.action === 'open') {
        this.onOpen();
        return;
      }
      const action = COPY_ACTIONS.find((a) => a.id === button.dataset.action);
      if (action) this.onCopy(action);
    });
    this.bindDrag();
    root.appendChild(this.element);
    this.renderFoot();
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
    this.element.hidden = true;
  }

  setPinned(pinned: boolean): void {
    this.pinned = pinned;
    this.element.classList.toggle('pinned', pinned);
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

  render(info: ElementInfo, settings: LensSettings): void {
    const head = h(
      'div',
      {},
      h('span', { class: 'summary' }, ...this.summary(info)),
      h(
        'span',
        { class: 'dims' },
        `${info.box.width.toString()} × ${info.box.height.toString()}`,
      ),
      this.pinned ? h('span', { class: 'pin' }, 'pinned') : null,
    );
    this.head.replaceChildren(...Array.from(head.childNodes));

    const sections: Child[] = [];
    if (settings.showBox) sections.push(this.box(info));
    if (settings.showEvents) sections.push(this.events(info));
    if (settings.showStyles) sections.push(this.styles(info.styles));
    if (settings.showAccessibility) sections.push(this.accessibility(info));
    if (settings.showAttributes && info.attributes.length) {
      sections.push(this.attributes(info));
    }
    if (settings.showMedia && info.media) sections.push(this.media(info));
    if (settings.showContext) sections.push(this.context(info));
    if (settings.showSelectors) sections.push(this.selectors(info));

    this.body.replaceChildren(...sections.filter((s): s is Node => !!s));
    this.body.scrollTop = 0;
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
    const edges = (name: string, cls: string, e: typeof box.margin) =>
      h(
        'div',
        { class: `cell ${cls}` },
        h('span', {}, name),
        `${e.top.toString()} ${e.right.toString()} ${e.bottom.toString()} ${e.left.toString()}`,
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
          h('span', { class: 'num' }, box.width.toString()),
          ' × ',
          h('span', { class: 'num' }, box.height.toString()),
        ),
      ),
      h(
        'div',
        { class: 'box-model' },
        edges('margin', 'm', box.margin),
        edges('padding', 'p', box.padding),
        edges('border', 'b', box.border),
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
        ),
      ),
    );
  }

  private accessibility(info: ElementInfo): HTMLElement {
    const { accessibility } = info;
    const rows: Child[] = [
      this.row(
        'Role',
        accessibility.role
          ? h('span', { class: 'kw' }, accessibility.role)
          : h('span', { class: 'muted' }, 'generic'),
      ),
      this.row(
        'Name',
        accessibility.name
          ? truncate(accessibility.name, 90)
          : h('span', { class: 'muted' }, 'none'),
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
            h('span', { class: 'value' }, `"${attr.value}"`),
          ),
          h('span'),
        ),
      );
    }
    return this.section('Accessibility', '', ...rows);
  }

  private attributes(info: ElementInfo): HTMLElement {
    const shown = info.attributes.slice(0, 12);
    const rows = shown.map((attr) =>
      h(
        'div',
        { class: 'row wide' },
        h(
          'span',
          { class: 'val' },
          h('span', { class: 'attr' }, attr.name),
          attr.value ? '=' : '',
          attr.value ? h('span', { class: 'value' }, `"${attr.value}"`) : null,
        ),
        h('span'),
      ),
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
      info.text
        ? this.row(
            'Text',
            h('span', { class: 'muted' }, truncate(info.text, 120)),
          )
        : null,
    );
  }

  private media(info: ElementInfo): HTMLElement {
    const media = info.media;
    if (!media) return h('div');
    const rows: Child[] = [this.row('Kind', media.kind)];
    if (media.source)
      rows.push(this.row('Source', truncate(media.source, 160)));
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
        this.row('Alt', media.alt || h('span', { class: 'muted' }, 'empty')),
      );
    return this.section('Media', '', ...rows);
  }

  private renderFoot(): void {
    const hints: Child[] = [
      h('span', {}, h('kbd', {}, 'click'), this.pinned ? 'unpin' : 'pin'),
      this.pinned ? h('span', {}, h('kbd', {}, 'drag'), 'move') : null,
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
