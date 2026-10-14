import {
  getCssSelector,
  getElementSummary,
  getTestIdSelector,
} from './selector';

function el(selector: string): Element {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`missing ${selector}`);
  return node;
}

describe('selector', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <button id="save" class="btn primary">Save</button>
        <button data-testid="cancel" class="btn">Cancel</button>
        <ul class="list">
          <li class="item">one</li>
          <li class="item">two</li>
          <li class="item css-1x2y3z">three</li>
        </ul>
        <div class="dupe"></div>
        <section><div class="dupe"></div></section>
      </main>`;
  });

  it('prefers test ids, then unique ids', () => {
    expect(getCssSelector(el('[data-testid]'))).toBe('[data-testid="cancel"]');
    expect(getCssSelector(el('#save'))).toBe('#save');
  });

  it('uses stable classes and nth-of-type for siblings', () => {
    expect(getCssSelector(el('li:nth-child(2)'))).toBe('li:nth-of-type(2)');
  });

  it('drops generated class names', () => {
    expect(getCssSelector(el('li:nth-child(3)'))).toBe('li:nth-of-type(3)');
    expect(getCssSelector(el('li:nth-child(3)'))).not.toContain('css-');
  });

  it('walks up until the selector is unique', () => {
    const inner = el('section .dupe');
    expect(getCssSelector(inner)).toBe('section > div.dupe');
    expect(document.querySelectorAll(getCssSelector(inner))).toHaveLength(1);
  });

  it('scopes selectors to the shadow root of the element', () => {
    const host = document.createElement('x-widget');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = '<button class="btn">In</button><span id="save"></span>';
    expect(getCssSelector(root.querySelector('button')!)).toBe('button.btn');
    expect(getCssSelector(root.querySelector('span')!)).toBe('#save');
  });

  it('builds a readable summary', () => {
    const node = document.createElement('div');
    node.id = 'x';
    node.className = 'a b c d e';
    expect(getElementSummary(node)).toBe('div#x.a.b.c +2');
    expect(getTestIdSelector(node)).toBeNull();
  });
});
