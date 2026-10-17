import { bestLocator, getLocators } from './locator';

function pick(selector: string): Element {
  return document.querySelector(selector)!;
}

describe('locator', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button data-testid="save">Save</button>
      <button>Save</button>
      <label for="e">Email</label><input id="e" placeholder="you@x">
      <img alt="Logo" title="Home">
      <p class="note">Some note</p>`;
  });

  it('ranks test ids first and marks uniqueness', () => {
    const locators = getLocators(pick('[data-testid]'));
    expect(locators[0]).toEqual({
      strategy: 'testId',
      code: "page.getByTestId('save')",
      matches: 1,
    });
    const role = locators.find((l) => l.strategy === 'role')!;
    expect(role.code).toBe("page.getByRole('button', { name: 'Save' })");
    expect(role.matches).toBe(2);
    expect(bestLocator(locators)?.strategy).toBe('testId');
  });

  it('offers label and placeholder for fields', () => {
    const codes = getLocators(pick('input')).map((l) => l.code);
    expect(codes).toContain("page.getByLabel('Email')");
    expect(codes).toContain("page.getByPlaceholder('you@x')");
    expect(codes).toContain("page.getByRole('textbox', { name: 'Email' })");
  });

  it('offers alt text and title for images', () => {
    const codes = getLocators(pick('img')).map((l) => l.code);
    expect(codes).toContain("page.getByAltText('Logo')");
    expect(codes).toContain("page.getByTitle('Home')");
  });

  it('offers exact text for leaf text nodes and a css fallback', () => {
    const locators = getLocators(pick('.note'));
    expect(locators.map((l) => l.code)).toContain(
      "page.getByText('Some note', { exact: true })",
    );
    expect(locators[locators.length - 1]?.strategy).toBe('css');
    expect(locators.find((l) => l.strategy === 'text')?.matches).toBe(1);
  });

  it('counts matches through shadow roots like Playwright does', () => {
    const host = document.createElement('x-widget');
    document.body.append(host);
    host.attachShadow({ mode: 'open' }).innerHTML =
      '<button data-testid="save">Save</button>';
    const inner = host.shadowRoot!.querySelector('button')!;
    const locators = getLocators(inner);
    expect(locators.find((l) => l.strategy === 'testId')?.matches).toBe(2);
    expect(locators.find((l) => l.strategy === 'role')?.matches).toBe(3);
    expect(locators.find((l) => l.strategy === 'css')?.code).toBe(
      'page.locator(\'[data-testid="save"]\')',
    );
  });

  it('escapes quotes in values', () => {
    document.body.innerHTML = `<button>It's "ok"</button>`;
    const codes = getLocators(pick('button')).map((l) => l.code);
    expect(codes).toContain(`page.getByText('It\\'s "ok"', { exact: true })`);
  });

  it('adds exact only when it narrows a case-insensitive substring match', () => {
    document.body.innerHTML = `
      <button>Save</button><button>Save draft</button>
      <input placeholder="Search"><input placeholder="search docs">`;
    const [save, draft] = Array.from(document.querySelectorAll('button'));
    const role = (el: Element) =>
      getLocators(el).find((l) => l.strategy === 'role');

    expect(role(save)).toEqual({
      strategy: 'role',
      code: "page.getByRole('button', { name: 'Save', exact: true })",
      matches: 1,
    });
    expect(role(draft)).toEqual({
      strategy: 'role',
      code: "page.getByRole('button', { name: 'Save draft' })",
      matches: 1,
    });
    expect(
      getLocators(pick('input')).find((l) => l.strategy === 'placeholder'),
    ).toEqual({
      strategy: 'placeholder',
      code: "page.getByPlaceholder('Search', { exact: true })",
      matches: 1,
    });
  });

  it('shortens long names at a word boundary instead of adding an ellipsis', () => {
    const words = Array.from({ length: 20 }, (_, i) => `word${i.toString()}`);
    document.body.innerHTML = `<a href="/guide">a ${words.join(' ')}</a>`;
    const role = getLocators(pick('a')).find((l) => l.strategy === 'role');
    expect(role).toEqual({
      strategy: 'role',
      code: `page.getByRole('link', { name: 'a ${words.slice(0, 12).join(' ')}' })`,
      matches: 1,
    });
  });

  it('leaves elements hidden from assistive tech out of role counts', () => {
    document.body.innerHTML = `
      <button>Menu</button>
      <button hidden>Menu</button>
      <div aria-hidden="true"><button>Menu</button></div>
      <div style="visibility: hidden"><button>Menu</button></div>`;
    const role = getLocators(pick('button')).find((l) => l.strategy === 'role');
    expect(role?.matches).toBe(1);
  });

  it('takes labels from label elements and aria, never from placeholders', () => {
    document.body.innerHTML =
      '<input placeholder="Search"><input aria-label="Query">';
    const strategies = getLocators(pick('input')).map((l) => l.strategy);
    expect(strategies).not.toContain('label');
    expect(getLocators(pick('[aria-label]')).map((l) => l.code)).toContain(
      "page.getByLabel('Query')",
    );
  });

  it('leaves the name out for roles that do not take it from content', () => {
    document.body.innerHTML = '<nav><a href="/">Home</a></nav>';
    const role = getLocators(pick('nav')).find((l) => l.strategy === 'role');
    expect(role).toEqual({
      strategy: 'role',
      code: "page.getByRole('navigation')",
      matches: 1,
    });
  });

  it('falls back to the first locator when none is unique', () => {
    expect(bestLocator([])).toBeUndefined();
    const two = { strategy: 'css' as const, code: 'x', matches: 2 };
    expect(bestLocator([two])).toBe(two);
  });
});
