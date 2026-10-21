import { getGaps, readGap } from './gaps';

const none = { top: 0, right: 0, bottom: 0, left: 0 };

function style(values: Record<string, string>): CSSStyleDeclaration {
  return {
    getPropertyValue: (property: string) => values[property] ?? '',
  } as CSSStyleDeclaration;
}

function rect(left: number, top: number, width: number, height: number) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  } as DOMRect;
}

function container(...children: DOMRect[]): HTMLElement {
  const el = document.createElement('div');
  for (const box of children) {
    const child = document.createElement('div');
    child.getBoundingClientRect = () => box;
    el.append(child);
  }
  document.body.append(el);
  return el;
}

describe('gaps', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reads the gap of flex and grid containers only', () => {
    expect(readGap(style({ display: 'block', 'row-gap': '8px' }))).toBeNull();
    expect(
      readGap(
        style({
          display: 'inline-flex',
          'row-gap': 'normal',
          'column-gap': '12px',
        }),
      ),
    ).toEqual({ row: 0, column: 12 });
    expect(
      getGaps(container(), style({ display: 'flex' }), {
        rect: rect(0, 0, 100, 100),
        border: none,
        padding: none,
      }),
    ).toEqual([]);
  });

  it('places grid gaps between the resolved tracks', () => {
    const grid = {
      display: 'grid',
      'grid-template-columns': '[full] 100px [a] 50px 100px',
      'grid-template-rows': '40px 40px',
      'row-gap': '10px',
      'column-gap': '20px',
    };
    const context = {
      rect: rect(0, 0, 310, 100),
      border: { top: 1, right: 1, bottom: 1, left: 1 },
      padding: { top: 4, right: 4, bottom: 4, left: 4 },
    };
    expect(getGaps(container(), style(grid), context)).toEqual([
      { x: 105, y: 5, width: 20, height: 90 },
      { x: 175, y: 5, width: 20, height: 90 },
      { x: 5, y: 45, width: 290, height: 10 },
    ]);

    const centered = getGaps(
      container(),
      style({ ...grid, 'justify-content': 'center' }),
      context,
    );
    expect(centered.map((gap) => gap.x)).toEqual([110, 180, 10]);

    const rtl = getGaps(
      container(),
      style({ ...grid, direction: 'rtl' }),
      context,
    );
    expect(rtl.map((gap) => gap.x)).toEqual([185, 115, 15]);
  });

  it('finds flex lines and puts each gap in the space between items', () => {
    const el = container(
      rect(0, 0, 100, 20),
      rect(110, 0, 90, 30),
      rect(0, 40, 50, 20),
    );
    const flex = {
      display: 'flex',
      'flex-wrap': 'wrap',
      'row-gap': '10px',
      'column-gap': '10px',
    };
    const context = { rect: rect(0, 0, 300, 60), border: none, padding: none };
    expect(getGaps(el, style(flex), context)).toEqual([
      { x: 100, y: 0, width: 10, height: 30 },
      { x: 0, y: 30, width: 300, height: 10 },
    ]);

    const spread = container(rect(0, 0, 100, 20), rect(190, 0, 100, 20));
    expect(getGaps(spread, style(flex), context)).toEqual([
      { x: 140, y: 0, width: 10, height: 20 },
    ]);
  });

  it('turns the axes for a column flex container and skips out-of-flow items', () => {
    const el = container(rect(10, 10, 80, 30), rect(10, 50, 80, 30));
    const floating = document.createElement('div');
    floating.style.position = 'absolute';
    floating.getBoundingClientRect = () => rect(10, 40, 80, 10);
    el.append(floating);
    const empty = document.createElement('div');
    empty.getBoundingClientRect = () => rect(10, 90, 0, 0);
    el.append(empty);
    const column = {
      display: 'flex',
      'flex-direction': 'column',
      'row-gap': '10px',
      'column-gap': '0px',
    };
    expect(
      getGaps(el, style(column), {
        rect: rect(10, 10, 80, 100),
        border: none,
        padding: none,
      }),
    ).toEqual([{ x: 0, y: 30, width: 80, height: 10 }]);
  });
});
