import { countMatches, cssEscape, rootOf } from '../dom/dom';

export const TEST_ID_ATTRIBUTES = [
  'data-testid',
  'data-test-id',
  'data-test',
  'data-cy',
  'data-qa',
] as const;

const DYNAMIC_CLASS =
  /^(?:[a-z]+[-_])?[a-z0-9]*\d[a-z0-9]*$|^(?:css|sc|jss|emotion)-/i;

function isUnique(selector: string, root: ParentNode): boolean {
  return countMatches(selector, root) === 1;
}

function stableClasses(el: Element): string[] {
  return Array.from(el.classList).filter(
    (name) => !DYNAMIC_CLASS.test(name) && name.length < 40,
  );
}

function nthOfType(el: Element): number {
  let index = 1;
  let sibling = el.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === el.tagName) index += 1;
    sibling = sibling.previousElementSibling;
  }
  return index;
}

export function getTestIdSelector(el: Element): string | null {
  for (const attribute of TEST_ID_ATTRIBUTES) {
    const value = el.getAttribute(attribute);
    if (value) {
      return `[${attribute}="${cssEscape(value)}"]`;
    }
  }
  return null;
}

function localSelector(el: Element, root: ParentNode): string {
  const tag = el.localName;

  if (el.id && isUnique(`#${cssEscape(el.id)}`, root)) {
    return `#${cssEscape(el.id)}`;
  }

  const classes = stableClasses(el).map((name) => `.${cssEscape(name)}`);
  if (classes.length) {
    const withClasses = `${tag}${classes.join('')}`;
    const parent = el.parentElement;
    const siblings = parent ? parent.children : [];
    const sameAmongSiblings = Array.from(siblings).filter((sibling) =>
      sibling.matches(withClasses),
    ).length;
    if (sameAmongSiblings <= 1) return withClasses;
  }

  const parent = el.parentElement;
  const sameTag = parent
    ? Array.from(parent.children).filter((c) => c.tagName === el.tagName)
    : [el];
  if (sameTag.length === 1) return tag;

  return `${tag}:nth-of-type(${nthOfType(el).toString()})`;
}

export function getCssSelector(el: Element): string {
  const root = rootOf(el);
  const testId = getTestIdSelector(el);
  if (testId && isUnique(testId, root)) return testId;

  if (el.id && isUnique(`#${cssEscape(el.id)}`, root)) {
    return `#${cssEscape(el.id)}`;
  }

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    const part = localSelector(current, root);
    parts.unshift(part);

    const candidate = parts.join(' > ');
    if (part.startsWith('#') || isUnique(candidate, root)) {
      return candidate;
    }

    current = current.parentElement;
  }

  return parts.length ? parts.join(' > ') : el.localName;
}

export function getElementSummary(el: Element): string {
  let summary = el.localName;
  if (el.id) summary += `#${el.id}`;
  for (const name of Array.from(el.classList).slice(0, 3)) {
    summary += `.${name}`;
  }
  if (el.classList.length > 3) {
    summary += ` +${(el.classList.length - 3).toString()}`;
  }
  return summary;
}
