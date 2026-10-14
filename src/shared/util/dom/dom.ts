import { APP_ID } from '../../consts/config';

export const HOST_TAG = `${APP_ID}-host`;

export function isOwnNode(node: Node | null): boolean {
  let current: Node | null = node;
  while (current) {
    if (current instanceof Element && current.localName === HOST_TAG) {
      return true;
    }
    current = current instanceof ShadowRoot ? current.host : current.parentNode;
  }
  return false;
}

export function deepElementFromPoint(x: number, y: number): Element | null {
  let root: Document | ShadowRoot = document;
  let found: Element | null = null;

  for (;;) {
    const next: Element | null = root.elementFromPoint(x, y);
    if (!next || next === found) break;
    found = next;
    if (!next.shadowRoot) break;
    root = next.shadowRoot;
  }

  return found;
}

export function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' ? CSS.escape(value) : value;
}

export function rootOf(el: Element): Document | ShadowRoot {
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root : document;
}

export function parentOf(el: Element): Element | null {
  if (el.parentElement) return el.parentElement;
  const root = el.getRootNode();
  return root instanceof ShadowRoot ? root.host : null;
}

export function countMatches(selector: string, root: ParentNode = document) {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return 0;
  }
}

export function* walkDeep(root: ParentNode = document): Generator<Element> {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    yield el;
    if (el.shadowRoot) yield* walkDeep(el.shadowRoot);
  }
}

export function countDeep(selector: string, root: ParentNode = document) {
  let count = countMatches(selector, root);
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (el.shadowRoot) count += countDeep(selector, el.shadowRoot);
  }
  return count;
}
