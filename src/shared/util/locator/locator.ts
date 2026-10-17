import { Locator, LocatorStrategy } from '../../types';
import {
  getAccessibleName,
  getLabels,
  getRole,
  isHiddenForAria,
} from '../a11y/a11y';
import { countDeep, cssEscape, walkDeep } from '../dom/dom';
import { squash } from '../format/format';
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

interface Counts {
  loose: number;
  exact: number;
}

interface Choice {
  value: string;
  exact: boolean;
  matches: number;
}

type Values = (node: Element) => string[];

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

// ? Playwright matches a case-insensitive substring unless exact: true asks for the whole value
function tally(
  wanted: string,
  values: Values,
  options: { normalise: boolean; visibleOnly?: boolean },
): Counts {
  const clean = (value: string) => (options.normalise ? squash(value) : value);
  const target = clean(wanted);
  const lower = target.toLowerCase();
  const counts = { loose: 0, exact: 0 };
  for (const node of walkDeep(document.body)) {
    const found = values(node).map(clean);
    if (!found.some((value) => value.toLowerCase().includes(lower))) continue;
    if (options.visibleOnly && isHiddenForAria(node)) continue;
    counts.loose += 1;
    if (found.includes(target)) counts.exact += 1;
  }
  return counts;
}

function trimToWord(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const space = cut.lastIndexOf(' ');
  const boundary = /\s/.test(value.charAt(max)) || space < 1;
  return (boundary ? cut : cut.slice(0, space)).trimEnd();
}

// ? like codegen: the plain form unless exact: true narrows the match, and a word-trimmed prefix for long values
function choose(value: string, count: (wanted: string) => Counts): Choice {
  if (value.length > MAX_TEXT) {
    const prefix = trimToWord(value, MAX_TEXT);
    return { value: prefix, exact: false, matches: count(prefix).loose };
  }
  const { loose, exact } = count(value);
  return exact < loose
    ? { value, exact: true, matches: exact }
    : { value, exact: false, matches: loose };
}

function exactly(choice: Choice): Record<string, boolean> {
  return choice.exact ? { exact: true } : {};
}

function attributeValues(name: string): Values {
  return (node) => {
    const value = node.getAttribute(name);
    return value === null ? [] : [value];
  };
}

function roleNames(role: string): Values {
  return (node) =>
    getRole(node) === role ? [getAccessibleName(node, role)] : [];
}

function countByRole(role: string): number {
  let count = 0;
  for (const node of walkDeep(document.body)) {
    if (getRole(node) === role && !isHiddenForAria(node)) count += 1;
  }
  return count;
}

const LABELLED =
  'input, textarea, select, button, meter, output, progress, [aria-label], [aria-labelledby]';

function labels(node: Element): string[] {
  return node.matches(LABELLED) ? getLabels(node) : [];
}

export function getLocators(el: Element): Locator[] {
  const found: Locator[] = [];
  const push = (strategy: LocatorStrategy, code: string, matches: number) => {
    found.push({ strategy, code, matches });
  };
  const byAttribute = (strategy: LocatorStrategy, name: string) => {
    const value = el.getAttribute(name);
    if (!value) return;
    const choice = choose(value, (wanted) =>
      tally(wanted, attributeValues(name), { normalise: false }),
    );
    push(
      strategy,
      call(strategy, choice.value, exactly(choice)),
      choice.matches,
    );
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
  if (role && role !== 'presentation' && role !== 'none') {
    const name = getAccessibleName(el, role);
    if (name) {
      const choice = choose(name, (wanted) =>
        tally(wanted, roleNames(role), { normalise: true, visibleOnly: true }),
      );
      push(
        'role',
        call('role', role, { name: choice.value, ...exactly(choice) }),
        choice.matches,
      );
    } else {
      push('role', call('role', role), countByRole(role));
    }
  }

  const isField = el.matches('input, textarea, select');
  const label = isField ? getLabels(el).find(Boolean) : undefined;
  if (label) {
    const choice = choose(label, (wanted) =>
      tally(wanted, labels, { normalise: true }),
    );
    push('label', call('label', choice.value, exactly(choice)), choice.matches);
  }

  byAttribute('placeholder', 'placeholder');
  if (el.localName === 'img' || el.localName === 'area') {
    byAttribute('altText', 'alt');
  }
  byAttribute('title', 'title');

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
