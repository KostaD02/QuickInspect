function positionAmongSameTag(el: Element): number {
  let index = 1;
  let sibling = el.previousElementSibling;
  while (sibling) {
    if (sibling.localName === el.localName) index += 1;
    sibling = sibling.previousElementSibling;
  }
  return index;
}

function hasSameTagSibling(el: Element): boolean {
  const parent = el.parentElement;
  if (!parent) return false;
  return (
    Array.from(parent.children).filter(
      (child) => child.localName === el.localName,
    ).length > 1
  );
}

import { rootOf } from '../dom/dom';

export function getXPath(el: Element): string {
  const root = rootOf(el);
  if (el.id) {
    const byId = `//*[@id="${el.id}"]`;
    if (root.getElementById(el.id) === el) {
      const duplicates = root.querySelectorAll(
        `[id="${el.id.replace(/"/g, '\\"')}"]`,
      ).length;
      if (duplicates === 1) return byId;
    }
  }

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const step = hasSameTagSibling(current)
      ? `${current.localName}[${positionAmongSameTag(current).toString()}]`
      : current.localName;
    parts.unshift(step);
    current = current.parentElement;
  }

  return `/${parts.join('/')}`;
}
