export type EditField =
  | { kind: 'style'; property: string; lengths?: boolean }
  | { kind: 'attribute'; name: string }
  | { kind: 'text' }
  | { kind: 'new-style' }
  | { kind: 'new-attribute' };

interface Snapshot {
  attributes: [string, string][];
  text: string | null;
}

// ? a removed style is stored as an empty string and a removed attribute as null
export interface EditDelta {
  styles: Record<string, string>;
  attributes: Record<string, string | null>;
  text?: string;
}

const IMPORTANT = /\s*!important\s*$/i;
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)$/;
const NEW_ATTRIBUTE =
  /^\s*([^\s="']+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|(.*?)))?\s*$/;

const snapshots = new WeakMap<Element, Snapshot>();
const edited = new Set<Element>();

function inlineStyle(el: Element): CSSStyleDeclaration | null {
  return el instanceof HTMLElement || el instanceof SVGElement
    ? el.style
    : null;
}

function propertyName(property: string): string {
  const name = property.trim();
  return name.startsWith('--') ? name : name.toLowerCase();
}

export function toLengths(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((part) => (NUMBER.test(part) ? `${part}px` : part))
    .join(' ');
}

function setStyle(el: Element, property: string, value: string): boolean {
  const style = inlineStyle(el);
  const name = propertyName(property);
  if (!style || !name) return false;
  const next = value.trim().replace(/;$/, '').trim();
  if (!next) {
    style.removeProperty(name);
    return true;
  }
  const important = IMPORTANT.test(next);
  const clean = next.replace(IMPORTANT, '');
  const previous = style.getPropertyValue(name);
  const priority = style.getPropertyPriority(name);
  const before = getComputedStyle(el).getPropertyValue(name);
  style.removeProperty(name);
  style.setProperty(name, clean, important ? 'important' : '');
  if (!style.getPropertyValue(name)) {
    if (previous) style.setProperty(name, previous, priority);
    return false;
  }
  if (!important && getComputedStyle(el).getPropertyValue(name) === before) {
    style.setProperty(name, clean, 'important');
  }
  return true;
}

function setAttribute(
  el: Element,
  name: string,
  value: string | null,
): boolean {
  const attribute = name.trim();
  if (!attribute) return false;
  try {
    if (value === null) el.removeAttribute(attribute);
    else el.setAttribute(attribute, value);
    return true;
  } catch {
    return false;
  }
}

function setText(el: Element, value: string): boolean {
  if (el.childElementCount > 0) return false;
  el.textContent = value;
  return true;
}

function apply(el: Element, field: EditField, value: string | null): boolean {
  switch (field.kind) {
    case 'style': {
      if (value === null) return setStyle(el, field.property, '');
      return setStyle(
        el,
        field.property,
        field.lengths ? toLengths(value) : value,
      );
    }
    case 'attribute':
      return setAttribute(el, field.name, value);
    case 'text':
      return setText(el, value ?? '');
    case 'new-style': {
      const text = value ?? '';
      const colon = text.indexOf(':');
      if (colon < 1) return false;
      const rest = text.slice(colon + 1);
      return rest.trim() !== '' && setStyle(el, text.slice(0, colon), rest);
    }
    case 'new-attribute': {
      const match = NEW_ATTRIBUTE.exec(value ?? '');
      const name = match?.at(1);
      if (!name) return false;
      return setAttribute(
        el,
        name,
        match?.at(2) ?? match?.at(3) ?? match?.at(4) ?? '',
      );
    }
  }
}

export function readField(el: Element, field: EditField): string {
  switch (field.kind) {
    case 'style': {
      const name = propertyName(field.property);
      const inline = inlineStyle(el)?.getPropertyValue(name) ?? '';
      return inline || getComputedStyle(el).getPropertyValue(name);
    }
    case 'attribute':
      return el.getAttribute(field.name) ?? '';
    case 'text':
      return el.textContent;
    default:
      return '';
  }
}

function snapshot(el: Element): boolean {
  if (snapshots.has(el)) return false;
  snapshots.set(el, {
    attributes: Array.from(el.attributes, (attr) => [attr.name, attr.value]),
    text: el.childElementCount === 0 ? el.textContent : null,
  });
  edited.add(el);
  return true;
}

function forget(el: Element): void {
  snapshots.delete(el);
  edited.delete(el);
}

export function writeField(
  el: Element,
  field: EditField,
  value: string | null,
): boolean {
  const fresh = snapshot(el);
  const written = apply(el, field, value);
  if (!written && fresh) forget(el);
  return written;
}

export function editedElements(): Element[] {
  return Array.from(edited).filter((el) => el.isConnected);
}

function declarations(cssText: string): CSSStyleDeclaration {
  const probe = document.createElement('div');
  probe.style.cssText = cssText;
  return probe.style;
}

function styled(style: CSSStyleDeclaration, name: string): string {
  const value = style.getPropertyValue(name);
  if (!value) return '';
  return style.getPropertyPriority(name) ? `${value} !important` : value;
}

export function editDelta(el: Element): EditDelta | null {
  const before = snapshots.get(el);
  if (!before) return null;
  const original = new Map(before.attributes);
  const delta: EditDelta = { styles: {}, attributes: {} };

  const was = declarations(original.get('style') ?? '');
  const now = declarations(el.getAttribute('style') ?? '');
  const names = new Set([...Array.from(was), ...Array.from(now)]);
  for (const name of names) {
    const value = styled(now, name);
    if (value !== styled(was, name)) delta.styles[name] = value;
  }

  const current = new Map(
    Array.from(el.attributes, (attr) => [attr.name, attr.value]),
  );
  for (const name of new Set([...original.keys(), ...current.keys()])) {
    if (name === 'style') continue;
    const value = current.get(name) ?? null;
    if (value !== (original.get(name) ?? null)) delta.attributes[name] = value;
  }

  if (
    before.text !== null &&
    el.childElementCount === 0 &&
    el.textContent !== before.text
  ) {
    delta.text = el.textContent;
  }

  const empty =
    !Object.keys(delta.styles).length &&
    !Object.keys(delta.attributes).length &&
    delta.text === undefined;
  return empty ? null : delta;
}

export function applyDelta(el: Element, delta: EditDelta): void {
  snapshot(el);
  const style = inlineStyle(el);
  for (const [name, value] of Object.entries(delta.styles)) {
    if (!style) break;
    if (!value) {
      style.removeProperty(name);
      continue;
    }
    const clean = value.replace(IMPORTANT, '');
    style.setProperty(name, clean, IMPORTANT.test(value) ? 'important' : '');
  }
  for (const [name, value] of Object.entries(delta.attributes)) {
    setAttribute(el, name, value);
  }
  if (delta.text !== undefined) setText(el, delta.text);
}

export function deltaToCss(selector: string, delta: EditDelta): string {
  const lines = Object.entries(delta.styles)
    .filter(([, value]) => value)
    .map(([name, value]) => `  ${name}: ${value};`);
  return lines.length ? `${selector} {\n${lines.join('\n')}\n}` : '';
}

export function hasEdits(el: Element): boolean {
  return snapshots.has(el);
}

export function revertEdits(el: Element): void {
  const snapshot = snapshots.get(el);
  if (!snapshot) return;
  forget(el);
  const kept = new Set(snapshot.attributes.map(([name]) => name));
  for (const attr of Array.from(el.attributes)) {
    if (!kept.has(attr.name)) el.removeAttribute(attr.name);
  }
  for (const [name, value] of snapshot.attributes) {
    if (el.getAttribute(name) !== value) el.setAttribute(name, value);
  }
  if (
    snapshot.text !== null &&
    el.childElementCount === 0 &&
    el.textContent !== snapshot.text
  ) {
    el.textContent = snapshot.text;
  }
}
