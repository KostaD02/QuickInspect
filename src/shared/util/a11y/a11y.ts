import { AccessibilityInfo, AttributeEntry } from '../../types';
import { squash } from '../format/format';

const INPUT_ROLES: Record<string, string> = {
  button: 'button',
  checkbox: 'checkbox',
  color: '',
  date: '',
  email: 'textbox',
  file: '',
  image: 'button',
  number: 'spinbutton',
  password: '',
  radio: 'radio',
  range: 'slider',
  reset: 'button',
  search: 'searchbox',
  submit: 'button',
  tel: 'textbox',
  text: 'textbox',
  url: 'textbox',
};

const TAG_ROLES: Record<string, string> = {
  a: 'link',
  article: 'article',
  aside: 'complementary',
  button: 'button',
  datalist: 'listbox',
  details: 'group',
  dialog: 'dialog',
  fieldset: 'group',
  figure: 'figure',
  form: 'form',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  hr: 'separator',
  img: 'img',
  li: 'listitem',
  main: 'main',
  math: 'math',
  menu: 'list',
  meter: 'meter',
  nav: 'navigation',
  ol: 'list',
  optgroup: 'group',
  option: 'option',
  output: 'status',
  progress: 'progressbar',
  search: 'search',
  select: 'combobox',
  summary: 'button',
  table: 'table',
  tbody: 'rowgroup',
  td: 'cell',
  textarea: 'textbox',
  tfoot: 'rowgroup',
  th: 'columnheader',
  thead: 'rowgroup',
  tr: 'row',
  ul: 'list',
};

export function getRole(el: Element): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit.trim().split(/\s+/)[0] ?? '';

  const tag = el.localName;

  if (tag === 'input') {
    const type = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (el.hasAttribute('list') && INPUT_ROLES[type] === 'textbox') {
      return 'combobox';
    }
    return INPUT_ROLES[type] ?? 'textbox';
  }

  if (tag === 'a' || tag === 'area') {
    return el.hasAttribute('href') ? 'link' : '';
  }

  if (tag === 'img' && el.getAttribute('alt') === '') return 'presentation';

  if (tag === 'header' || tag === 'footer') {
    const landmark = el.closest('article, aside, main, nav, section');
    if (landmark) return '';
    return tag === 'header' ? 'banner' : 'contentinfo';
  }

  if (tag === 'section') {
    return el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')
      ? 'region'
      : '';
  }

  if (
    tag === 'select' &&
    (el.hasAttribute('multiple') || Number(el.getAttribute('size')) > 1)
  ) {
    return 'listbox';
  }

  return TAG_ROLES[tag] ?? '';
}

function textOf(el: Element): string {
  return squash(el.textContent);
}

function labelledBy(el: Element): string {
  const ids = el.getAttribute('aria-labelledby');
  if (!ids) return '';
  return squash(
    ids
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
      .map((node) => node.getAttribute('aria-label') ?? textOf(node))
      .join(' '),
  );
}

function fromLabels(el: Element): string {
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLButtonElement ||
    el instanceof HTMLMeterElement ||
    el instanceof HTMLOutputElement ||
    el instanceof HTMLProgressElement
  ) {
    const labels = el.labels;
    if (labels && labels.length) {
      return squash(Array.from(labels).map(textOf).join(' '));
    }
  }
  return '';
}

export function getAccessibleName(el: Element): string {
  const fromIds = labelledBy(el);
  if (fromIds) return fromIds;

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel?.trim()) return squash(ariaLabel);

  const labelled = fromLabels(el);
  if (labelled) return labelled;

  const tag = el.localName;

  if (tag === 'img' || tag === 'area')
    return squash(el.getAttribute('alt') ?? '');

  if (tag === 'input') {
    const input = el as HTMLInputElement;
    const type = input.type;
    if (type === 'button' || type === 'submit' || type === 'reset') {
      return squash(
        input.value ||
          (type === 'submit' ? 'Submit' : type === 'reset' ? 'Reset' : ''),
      );
    }
    if (type === 'image') return squash(input.alt || input.value || 'Submit');
    return squash(input.placeholder || input.title);
  }

  if (tag === 'textarea') {
    const area = el as HTMLTextAreaElement;
    return squash(area.placeholder || area.title);
  }

  if (tag === 'svg') {
    const title = el.querySelector(':scope > title');
    if (title) return textOf(title);
  }

  if (tag === 'fieldset') {
    const legend = el.querySelector(':scope > legend');
    if (legend) return textOf(legend);
  }

  if (tag === 'figure') {
    const caption = el.querySelector(':scope > figcaption');
    if (caption) return textOf(caption);
  }

  if (tag === 'table') {
    const caption = el.querySelector(':scope > caption');
    if (caption) return textOf(caption);
  }

  const content = textOf(el);
  if (content) return content;

  return squash(el.getAttribute('title') ?? '');
}

const FOCUSABLE =
  'a[href], area[href], button, input, select, textarea, iframe, summary, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"])';

export function isFocusable(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return el.hasAttribute('tabindex');
  if (el.hasAttribute('disabled')) return false;
  if (el.hasAttribute('tabindex')) return true;
  return el.matches(FOCUSABLE);
}

export function getAriaAttributes(el: Element): AttributeEntry[] {
  return Array.from(el.attributes)
    .filter((attr) => attr.name.startsWith('aria-'))
    .map((attr) => ({ name: attr.name, value: attr.value }));
}

export function getAccessibility(el: Element): AccessibilityInfo {
  const tabIndexAttr = el.getAttribute('tabindex');
  const tabIndex = tabIndexAttr === null ? null : Number(tabIndexAttr);

  return {
    role: getRole(el),
    name: getAccessibleName(el),
    focusable: isFocusable(el),
    tabIndex: Number.isNaN(tabIndex) ? null : tabIndex,
    aria: getAriaAttributes(el),
  };
}
