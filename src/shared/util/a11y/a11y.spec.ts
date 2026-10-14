import {
  getAccessibility,
  getAccessibleName,
  getAriaAttributes,
  getRole,
  isFocusable,
} from './a11y';

function make(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
}

describe('a11y roles', () => {
  it('honours explicit roles', () => {
    expect(getRole(make('<div role="tab list"></div>'))).toBe('tab');
  });

  it('maps inputs by type', () => {
    expect(getRole(make('<input>'))).toBe('textbox');
    expect(getRole(make('<input type="checkbox">'))).toBe('checkbox');
    expect(getRole(make('<input type="password">'))).toBe('');
    expect(getRole(make('<input type="search">'))).toBe('searchbox');
    expect(getRole(make('<input list="x">'))).toBe('combobox');
  });

  it('handles links, images, landmarks and selects', () => {
    expect(getRole(make('<a href="#">x</a>'))).toBe('link');
    expect(getRole(make('<a>x</a>'))).toBe('');
    expect(getRole(make('<img alt="">'))).toBe('presentation');
    expect(getRole(make('<img alt="hi">'))).toBe('img');
    expect(getRole(make('<header></header>'))).toBe('banner');
    expect(
      getRole(make('<main><footer></footer></main>').firstElementChild!),
    ).toBe('');
    expect(getRole(make('<section></section>'))).toBe('');
    expect(getRole(make('<section aria-label="x"></section>'))).toBe('region');
    expect(getRole(make('<select multiple></select>'))).toBe('listbox');
    expect(getRole(make('<select></select>'))).toBe('combobox');
    expect(getRole(make('<h2>t</h2>'))).toBe('heading');
    expect(getRole(make('<div></div>'))).toBe('');
  });
});

describe('a11y names', () => {
  it('prefers aria-labelledby, then aria-label', () => {
    make(
      '<span id="l">Label</span><button aria-labelledby="l" aria-label="x">b</button>',
    );
    expect(getAccessibleName(document.querySelector('button')!)).toBe('Label');
    expect(
      getAccessibleName(make('<button aria-label=" Hi  there ">b</button>')),
    ).toBe('Hi there');
  });

  it('uses associated labels for form fields', () => {
    make('<label for="f">Email</label><input id="f">');
    expect(getAccessibleName(document.querySelector('input')!)).toBe('Email');
  });

  it('falls back per element type', () => {
    expect(getAccessibleName(make('<img alt="Avatar">'))).toBe('Avatar');
    expect(getAccessibleName(make('<input type="submit">'))).toBe('Submit');
    expect(getAccessibleName(make('<input type="reset">'))).toBe('Reset');
    expect(getAccessibleName(make('<input type="button" value="Go">'))).toBe(
      'Go',
    );
    expect(getAccessibleName(make('<input type="image" alt="Pic">'))).toBe(
      'Pic',
    );
    expect(getAccessibleName(make('<input placeholder="you@x">'))).toBe(
      'you@x',
    );
    expect(
      getAccessibleName(make('<textarea placeholder="bio"></textarea>')),
    ).toBe('bio');
    expect(getAccessibleName(make('<svg><title>Icon</title></svg>'))).toBe(
      'Icon',
    );
    expect(
      getAccessibleName(make('<fieldset><legend>Set</legend></fieldset>')),
    ).toBe('Set');
    expect(
      getAccessibleName(make('<figure><figcaption>Cap</figcaption></figure>')),
    ).toBe('Cap');
    expect(
      getAccessibleName(make('<table><caption>Tab</caption></table>')),
    ).toBe('Tab');
    expect(getAccessibleName(make('<button> Save  it </button>'))).toBe(
      'Save it',
    );
    expect(getAccessibleName(make('<div title="Tip"></div>'))).toBe('Tip');
  });
});

describe('a11y focus and aria', () => {
  it('detects focusable elements', () => {
    expect(isFocusable(make('<button></button>'))).toBe(true);
    expect(isFocusable(make('<button disabled></button>'))).toBe(false);
    expect(isFocusable(make('<div tabindex="-1"></div>'))).toBe(true);
    expect(isFocusable(make('<div></div>'))).toBe(false);
    expect(isFocusable(make('<svg tabindex="0"></svg>'))).toBe(true);
  });

  it('collects aria attributes and the full summary', () => {
    const node = make(
      '<div role="button" aria-pressed="true" tabindex="0" data-x="1">Go</div>',
    );
    expect(getAriaAttributes(node)).toEqual([
      { name: 'aria-pressed', value: 'true' },
    ]);
    expect(getAccessibility(node)).toEqual({
      role: 'button',
      name: 'Go',
      focusable: true,
      tabIndex: 0,
      aria: [{ name: 'aria-pressed', value: 'true' }],
    });
    expect(
      getAccessibility(make('<div tabindex="abc"></div>')).tabIndex,
    ).toBeNull();
  });
});
