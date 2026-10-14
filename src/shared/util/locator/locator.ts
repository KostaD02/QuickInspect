import { Locator, LocatorStrategy } from '../../types';
import { getAccessibleName, getRole } from '../a11y/a11y';
import { countDeep, cssEscape, walkDeep } from '../dom/dom';
import { squash, truncate } from '../format/format';
import { getCssSelector, TEST_ID_ATTRIBUTES } from '../selector/selector';

const MAX_TEXT = 80;

const METHODS: Record<LocatorStrategy, string> = {
  testId: 'getByTestId',
  role: 'getByRole',
  label: 'getByLabel',
  placeholder: 'getByPlaceholder',
  altText: 'getByAltText',
  title: 'getByTitle',
  text: 'getByText',
  css: 'locator',
};

export const STRATEGY_LABELS: Record<LocatorStrategy, string> = {
  testId: 'Test id',
  role: 'Role',
  label: 'Label',
  placeholder: 'Placeholder',
  altText: 'Alt text',
  title: 'Title',
  text: 'Text',
  css: 'CSS',
};

function quote(value: string): string {
  const json = JSON.stringify(value);
  return `'${json.slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;
}

function call(
  strategy: LocatorStrategy,
  value: string,
  options: Record<string, string | boolean> = {},
): string {
  const args = [quote(value)];
  const entries = Object.entries(options);

  if (entries.length) {
    const body = entries
      .map(([key, option]) =>
        typeof option === 'boolean'
          ? `${key}: ${option ? 'true' : 'false'}`
          : `${key}: ${quote(option)}`,
      )
      .join(', ');
    args.push(`{ ${body} }`);
  }

  return `page.${METHODS[strategy]}(${args.join(', ')})`;
}

function ownText(el: Element): string {
  return squash(el.textContent);
}

function countByText(text: string): number {
  let count = 0;
  for (const node of walkDeep(document.body)) {
    if (ownText(node) !== text) continue;
    const childHit = Array.from(node.children).some(
      (child) => ownText(child) === text,
    );
    if (!childHit) count += 1;
  }
  return count;
}

function countByRole(role: string, name: string): number {
  let count = 0;
  for (const node of walkDeep(document.body)) {
    if (getRole(node) !== role) continue;
    if (name && getAccessibleName(node) !== name) continue;
    count += 1;
  }
  return count;
}

const LABELLED =
  'input, textarea, select, button, meter, output, progress, [aria-label], [aria-labelledby]';

function countByLabel(label: string): number {
  let count = 0;
  for (const node of walkDeep(document.body)) {
    if (node.matches(LABELLED) && getAccessibleName(node) === label) count += 1;
  }
  return count;
}

export function getLocators(el: Element): Locator[] {
  const found: Locator[] = [];
  const push = (strategy: LocatorStrategy, code: string, matches: number) => {
    found.push({ strategy, code, matches });
  };

  for (const attribute of TEST_ID_ATTRIBUTES) {
    const value = el.getAttribute(attribute);
    if (value) {
      push(
        'testId',
        call('testId', value),
        countDeep(`[${attribute}="${cssEscape(value)}"]`),
      );
      break;
    }
  }

  const role = getRole(el);
  const name = truncate(getAccessibleName(el), MAX_TEXT);
  if (role && role !== 'presentation' && role !== 'none') {
    const options: Record<string, string> = name ? { name } : {};
    push('role', call('role', role, options), countByRole(role, name));
  }

  const isField = el.matches('input, textarea, select');
  if (isField && name) {
    push('label', call('label', name), countByLabel(name));
  }

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) {
    push(
      'placeholder',
      call('placeholder', placeholder),
      countDeep(`[placeholder="${cssEscape(placeholder)}"]`),
    );
  }

  const alt = el.getAttribute('alt');
  if (alt && (el.localName === 'img' || el.localName === 'area')) {
    push(
      'altText',
      call('altText', alt),
      countDeep(`[alt="${cssEscape(alt)}"]`),
    );
  }

  const title = el.getAttribute('title');
  if (title) {
    push(
      'title',
      call('title', title),
      countDeep(`[title="${cssEscape(title)}"]`),
    );
  }

  const text = ownText(el);
  if (text && text.length <= MAX_TEXT && !isField && el.children.length === 0) {
    push('text', call('text', text, { exact: true }), countByText(text));
  }

  const selector = getCssSelector(el);
  push('css', call('css', selector), countDeep(selector));

  return found;
}

export function bestLocator(locators: Locator[]): Locator | undefined {
  return locators.find((locator) => locator.matches === 1) ?? locators[0];
}
