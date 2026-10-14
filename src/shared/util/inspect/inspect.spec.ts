import {
  getAncestors,
  getAttributes,
  getBox,
  getMedia,
  getStyles,
  inspectElement,
} from './inspect';

function pick(selector: string): HTMLElement {
  return document.querySelector(selector)!;
}

describe('inspect', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main style="display:flex">
        <section style="display:flex">
          <button id="b" class="x" style="margin:4px 8px;padding:2px;border:1px solid red;color:rgb(255,0,0);background-color:rgb(0,0,255);z-index:3;opacity:0.5;border-radius:4px" aria-label="Go" title="t">Go</button>
          <img src="a.png" alt="Pic">
          <canvas width="10" height="20"></canvas>
          <video src="v.mp4"></video>
          <audio src="a.mp3"></audio>
          <svg viewBox="0 0 8 8"></svg>
        </section>
      </main>`;
  });

  it('reads the box with margins, padding and border', () => {
    const button = pick('#b');
    button.getBoundingClientRect = () =>
      ({ left: 10, top: 20, width: 100, height: 30 }) as DOMRect;
    const box = getBox(button, getComputedStyle(button));
    expect(box).toMatchObject({ x: 10, y: 20, width: 100, height: 30 });
    expect(box.margin).toEqual({ top: 4, right: 8, bottom: 4, left: 8 });
    expect(box.padding).toEqual({ top: 2, right: 2, bottom: 2, left: 2 });
    expect(box.border.top).toBe(1);
  });

  it('collects always-on styles plus non-default ones', () => {
    const button = pick('#b');
    const styles = getStyles(button, getComputedStyle(button));
    const byName = Object.fromEntries(styles.map((s) => [s.property, s]));
    expect(byName.color).toEqual({
      property: 'color',
      value: '#ff0000',
      color: 'rgb(255, 0, 0)',
    });
    expect(byName['background-color'].value).toBe('#0000ff');
    expect(byName['z-index'].value).toBe('3');
    expect(byName.opacity.value).toBe('0.5');
    expect(byName.border).toBeDefined();
    expect(byName.display).toBeDefined();
  });

  it('adds flex child properties when the parent is a flex container', () => {
    const button = pick('#b');
    const real = getComputedStyle(button);
    const faked = {
      getPropertyValue: (name: string) =>
        name === 'order' ? '2' : real.getPropertyValue(name),
    } as CSSStyleDeclaration;
    const byName = Object.fromEntries(
      getStyles(button, faked).map((s) => [s.property, s.value]),
    );
    expect(byName.order).toBe('2');
    expect(byName['align-self']).toBeUndefined();
  });

  it('adds layout properties for flex and grid containers', () => {
    const main = pick('main');
    const names = getStyles(main, getComputedStyle(main)).map(
      (s) => s.property,
    );
    expect(names).toContain('flex-direction');
    main.style.display = 'grid';
    expect(
      getStyles(main, getComputedStyle(main)).map((s) => s.property),
    ).toContain('grid-template-columns');
  });

  it('lists attributes and ancestors', () => {
    const button = pick('#b');
    expect(getAttributes(button).map((a) => a.name)).toEqual(
      expect.arrayContaining(['id', 'class', 'aria-label', 'title']),
    );
    expect(getAncestors(button).map((a) => a.summary)).toEqual([
      'section',
      'main',
      'body',
    ]);
  });

  it('describes media elements', () => {
    expect(getMedia(pick('img'))).toMatchObject({ kind: 'image', alt: 'Pic' });
    expect(getMedia(pick('canvas'))).toMatchObject({
      kind: 'canvas',
      naturalWidth: 10,
      naturalHeight: 20,
    });
    expect(getMedia(pick('video'))?.kind).toBe('video');
    expect(getMedia(pick('audio'))?.kind).toBe('audio');
    expect(getMedia(pick('svg'))).toEqual({ kind: 'svg', source: '0 0 8 8' });
    expect(getMedia(pick('#b'))).toBeNull();
  });

  it('assembles the full element info', () => {
    const info = inspectElement(pick('#b'));
    expect(info.tag).toBe('button');
    expect(info.id).toBe('b');
    expect(info.classes).toEqual(['x']);
    expect(info.summary).toBe('button#b.x');
    expect(info.selector).toBe('#b');
    expect(info.xpath).toBe('//*[@id="b"]');
    expect(info.locators[0]?.code).toBe(
      "page.getByRole('button', { name: 'Go' })",
    );
    expect(info.events).toEqual({ listeners: [], framework: null });
    expect(info.accessibility.name).toBe('Go');
    expect(info.childCount).toBe(0);
    expect(info.media).toBeNull();
    expect(inspectElement(pick('img')).media?.kind).toBe('image');
    expect(info.shadowHost).toBeNull();
  });

  it('reports the shadow host and walks ancestors across the boundary', () => {
    const host = document.createElement('x-widget');
    host.id = 'w';
    pick('section').append(host);
    host.attachShadow({ mode: 'open' }).innerHTML = '<div><em>deep</em></div>';
    const em = host.shadowRoot!.querySelector('em')!;
    const info = inspectElement(em);
    expect(info.shadowHost).toBe('x-widget#w');
    expect(info.ancestors.map((a) => a.summary)).toEqual([
      'div',
      'x-widget#w',
      'section',
      'main',
    ]);
    expect(info.selector).toBe('em');
    expect(info.xpath).toBe('/div/em');
  });
});
