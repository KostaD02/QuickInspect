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

  it('falls back to the first locator when none is unique', () => {
    expect(bestLocator([])).toBeUndefined();
    const two = { strategy: 'css' as const, code: 'x', matches: 2 };
    expect(bestLocator([two])).toBe(two);
  });
});
