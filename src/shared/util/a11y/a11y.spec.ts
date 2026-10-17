import {
  getAccessibility,
  getAccessibleName,
  getAriaAttributes,
  getLabels,
  getRole,
  isFocusable,
  isHiddenForAria,
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

  it('takes names from content only for roles that allow it', () => {
    expect(getAccessibleName(make('<nav><a href="/">Home</a></nav>'))).toBe('');
    expect(getAccessibleName(make('<ul><li>One</li></ul>'))).toBe('');
    expect(getAccessibleName(make('<div>Text</div>'))).toBe('');
    expect(getAccessibleName(make('<nav title="Main">Home</nav>'))).toBe(
      'Main',
    );
    expect(getAccessibleName(make('<h2>Title</h2>'))).toBe('Title');
    expect(getAccessibleName(make('<a href="/">Docs</a>'))).toBe('Docs');
  });

  it('reads content the way assistive tech does', () => {
    expect(
      getAccessibleName(
        make('<button><span aria-hidden="true">close</span>Close</button>'),
      ),
    ).toBe('Close');
    expect(
      getAccessibleName(
        make(
          '<button>Save<span hidden>draft</span><script>x</script></button>',
        ),
      ),
    ).toBe('Save');
    expect(
      getAccessibleName(make('<button><img alt="Gear"> Settings</button>')),
    ).toBe('Gear Settings');
    expect(
      getAccessibleName(make('<a href="/"><div>Read</div><div>more</div></a>')),
    ).toBe('Read more');
    expect(
      getAccessibleName(
        make('<button><svg><title>Delete</title></svg></button>'),
      ),
    ).toBe('Delete');
    expect(
      getAccessibleName(make('<button><i aria-label="Search"></i></button>')),
    ).toBe('Search');
  });

  it('reads shadow content and slotted nodes', () => {
    const host = make('<div role="button">Light</div>');
    host.attachShadow({ mode: 'open' }).innerHTML = '<b>Buy</b> <slot></slot>';
    expect(getAccessibleName(host)).toBe('Buy Light');
  });

  it('prefers title over placeholder and only uses placeholders on text fields', () => {
    expect(
      getAccessibleName(make('<input title="Find" placeholder="Search">')),
    ).toBe('Find');
    expect(
      getAccessibleName(make('<input type="number" placeholder="Qty">')),
    ).toBe('');
  });

  it('resolves aria-labelledby inside a shadow root', () => {
    const host = make('<div></div>');
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<span id="t">Title</span><div role="dialog" aria-labelledby="t"></div>';
    expect(getAccessibleName(root.querySelector('[role]')!)).toBe('Title');
  });
});

describe('a11y labels and visibility', () => {
  it('collects the texts getByLabel matches', () => {
    make(`
      <label for="a">Email</label><input id="a" placeholder="x">
      <span id="n">Name</span><input id="b" aria-labelledby="n" aria-label="x">
      <input id="c" aria-label=" Query "><input id="d" placeholder="Search">`);
    const labelsOf = (id: string) => getLabels(document.getElementById(id)!);
    expect(labelsOf('a')).toEqual(['Email']);
    expect(labelsOf('b')).toEqual(['Name']);
    expect(labelsOf('c')).toEqual(['Query']);
    expect(labelsOf('d')).toEqual([]);
  });

  it('detects elements hidden from assistive tech', () => {
    make(`
      <button id="shown">v</button>
      <div aria-hidden="true"><b id="aria">a</b></div>
      <div style="display: none"><b id="none">n</b></div>
      <div style="visibility: hidden"><b id="invisible">i</b></div>
      <template id="tpl"></template>`);
    const hidden = (id: string) =>
      isHiddenForAria(document.getElementById(id)!);
    expect(hidden('shown')).toBe(false);
    expect(hidden('aria')).toBe(true);
    expect(hidden('none')).toBe(true);
    expect(hidden('invisible')).toBe(true);
    expect(hidden('tpl')).toBe(true);
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
