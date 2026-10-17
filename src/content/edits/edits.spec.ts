import {
  hasEdits,
  readField,
  revertEdits,
  toLengths,
  writeField,
} from './edits';

function make(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe('edits', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('turns bare numbers into pixel lengths', () => {
    expect(toLengths(' 4 0 .5 -2 ')).toBe('4px 0px .5px -2px');
    expect(toLengths('auto 10% 1em')).toBe('auto 10% 1em');
  });

  it('reads inline styles first, then computed values, attributes and text', () => {
    const el = make('<p style="color: blue" title="t">hello</p>');
    expect(readField(el, { kind: 'style', property: 'color' })).toBe('blue');
    expect(readField(el, { kind: 'style', property: 'DISPLAY' })).toBe(
      getComputedStyle(el).getPropertyValue('display'),
    );
    expect(readField(el, { kind: 'attribute', name: 'title' })).toBe('t');
    expect(readField(el, { kind: 'attribute', name: 'missing' })).toBe('');
    expect(readField(el, { kind: 'text' })).toBe('hello');
    expect(readField(el, { kind: 'new-style' })).toBe('');
  });

  it('writes styles, rejects invalid values and forces overridden ones', () => {
    const el = make('<p style="color: blue">x</p>');
    expect(writeField(el, { kind: 'style', property: 'color' }, 'red;')).toBe(
      true,
    );
    expect(el.style.color).toBe('red');
    expect(writeField(el, { kind: 'style', property: 'color' }, 'nope')).toBe(
      false,
    );
    expect(el.style.color).toBe('red');
    expect(
      writeField(
        el,
        { kind: 'style', property: 'margin', lengths: true },
        '4 8',
      ),
    ).toBe(true);
    expect(el.style.margin).toBe('4px 8px');
    expect(
      writeField(el, { kind: 'style', property: 'width' }, '10px !important'),
    ).toBe(true);
    expect(el.style.getPropertyPriority('width')).toBe('important');
    expect(writeField(el, { kind: 'style', property: '--Gap' }, '3px')).toBe(
      true,
    );
    expect(el.style.getPropertyValue('--Gap')).toBe('3px');
    expect(writeField(el, { kind: 'style', property: 'color' }, ' ')).toBe(
      true,
    );
    expect(el.style.color).toBe('');
    expect(writeField(el, { kind: 'style', property: 'width' }, null)).toBe(
      true,
    );
    expect(el.style.width).toBe('');
    expect(writeField(el, { kind: 'style', property: ' ' }, 'red')).toBe(false);

    jest.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => 'rgb(1, 2, 3)',
    } as unknown as CSSStyleDeclaration);
    expect(writeField(el, { kind: 'style', property: 'color' }, 'green')).toBe(
      true,
    );
    expect(el.style.getPropertyPriority('color')).toBe('important');

    const plain = document.createElementNS('urn:x', 'thing');
    expect(writeField(plain, { kind: 'style', property: 'color' }, 'red')).toBe(
      false,
    );
    expect(hasEdits(plain)).toBe(false);
  });

  it('writes attributes, text and new entries', () => {
    const el = make('<p title="t">hello</p>');
    expect(writeField(el, { kind: 'attribute', name: 'title' }, 'u')).toBe(
      true,
    );
    expect(el.title).toBe('u');
    expect(writeField(el, { kind: 'attribute', name: 'title' }, null)).toBe(
      true,
    );
    expect(el.hasAttribute('title')).toBe(false);
    expect(writeField(el, { kind: 'attribute', name: '1 bad' }, 'x')).toBe(
      false,
    );
    expect(writeField(el, { kind: 'attribute', name: ' ' }, 'x')).toBe(false);

    expect(writeField(el, { kind: 'text' }, 'bye')).toBe(true);
    expect(el.textContent).toBe('bye');
    expect(writeField(el, { kind: 'text' }, null)).toBe(true);
    expect(el.textContent).toBe('');
    const parent = make('<div><b>x</b></div>');
    expect(writeField(parent, { kind: 'text' }, 'y')).toBe(false);

    expect(writeField(el, { kind: 'new-style' }, 'color: red;')).toBe(true);
    expect(el.style.color).toBe('red');
    expect(writeField(el, { kind: 'new-style' }, 'nocolon')).toBe(false);
    expect(writeField(el, { kind: 'new-style' }, ': red')).toBe(false);
    expect(writeField(el, { kind: 'new-style' }, 'color:  ')).toBe(false);
    expect(writeField(el, { kind: 'new-style' }, null)).toBe(false);

    expect(writeField(el, { kind: 'new-attribute' }, 'data-a="1 2"')).toBe(
      true,
    );
    expect(writeField(el, { kind: 'new-attribute' }, "data-b='3'")).toBe(true);
    expect(writeField(el, { kind: 'new-attribute' }, 'data-c = 4')).toBe(true);
    expect(writeField(el, { kind: 'new-attribute' }, 'hidden')).toBe(true);
    expect(el.dataset).toMatchObject({ a: '1 2', b: '3', c: '4' });
    expect(el.getAttribute('hidden')).toBe('');
    expect(writeField(el, { kind: 'new-attribute' }, '=x')).toBe(false);
    expect(writeField(el, { kind: 'new-attribute' }, null)).toBe(false);
  });

  it('remembers the original element and resets every edit', () => {
    const el = make('<p class="a" style="color: blue">hello</p>');
    expect(hasEdits(el)).toBe(false);
    expect(writeField(el, { kind: 'style', property: 'color' }, 'nope')).toBe(
      false,
    );
    expect(hasEdits(el)).toBe(false);

    writeField(el, { kind: 'style', property: 'color' }, 'red');
    writeField(el, { kind: 'attribute', name: 'class' }, 'b');
    writeField(el, { kind: 'new-attribute' }, 'data-x=1');
    writeField(el, { kind: 'text' }, 'bye');
    expect(hasEdits(el)).toBe(true);

    revertEdits(el);
    expect(hasEdits(el)).toBe(false);
    expect(el.style.length).toBe(1);
    expect(el.style.color).toBe('blue');
    expect(el.className).toBe('a');
    expect(el.hasAttribute('data-x')).toBe(false);
    expect(el.textContent).toBe('hello');
    revertEdits(el);
    expect(el.textContent).toBe('hello');

    const parent = make('<div title="t"><b>x</b></div>');
    writeField(parent, { kind: 'attribute', name: 'title' }, 'u');
    revertEdits(parent);
    expect(parent.title).toBe('t');
    expect(parent.innerHTML).toBe('<b>x</b>');
  });
});
