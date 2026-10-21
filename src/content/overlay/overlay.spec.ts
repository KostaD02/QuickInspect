import { BoxInfo } from '@/shared/types';
import { Overlay } from './overlay';

const box: BoxInfo = {
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  margin: { top: 10, right: 10, bottom: 10, left: 10 },
  padding: { top: 5, right: 5, bottom: 5, left: 5 },
  border: { top: 0, right: 0, bottom: 0, left: 0 },
  gap: null,
  gaps: [],
};

describe('overlay', () => {
  it('positions margin, padding and content boxes around the target', () => {
    const root = document.createElement('div');
    const overlay = new Overlay(root);
    const target = document.createElement('div');
    target.getBoundingClientRect = () =>
      ({ left: 50, top: 60, width: 100, height: 50 }) as DOMRect;

    overlay.show(target, box, 'div.x');

    const wrap = root.querySelector<HTMLElement>('.overlay')!;
    expect(wrap.hidden).toBe(false);
    expect(wrap.style.transform).toBe('translate(40px, 50px)');
    expect(wrap.style.width).toBe('120px');
    const content = root.querySelector<HTMLElement>('.overlay-content')!;
    expect(content.style.left).toBe('15px');
    expect(content.style.width).toBe('90px');
    expect(root.querySelector('.overlay-label')?.textContent).toBe(
      'div.x100 × 50',
    );
    expect(
      root.querySelector('.overlay-label')?.classList.contains('below'),
    ).toBe(false);

    overlay.setBoxModel(false);
    overlay.show(target, box, 'div.x');
    expect(root.querySelector<HTMLElement>('.overlay-margin')!.hidden).toBe(
      true,
    );
    expect(content.style.left).toBe('10px');

    target.getBoundingClientRect = () =>
      ({ left: 0, top: 5, width: 10, height: 10 }) as DOMRect;
    overlay.show(target, box, 'div.x');
    expect(
      root.querySelector('.overlay-label')?.classList.contains('below'),
    ).toBe(true);

    overlay.hide();
    expect(wrap.hidden).toBe(true);
  });

  it('draws the border band and the gaps of a flex or grid container', () => {
    const root = document.createElement('div');
    const overlay = new Overlay(root);
    const target = document.createElement('div');
    target.getBoundingClientRect = () =>
      ({ left: 50, top: 60, width: 100, height: 50 }) as DOMRect;
    const grid: BoxInfo = {
      ...box,
      border: { top: 2, right: 2, bottom: 2, left: 2 },
      gap: { row: 4, column: 6 },
      gaps: [
        { x: 40, y: 7, width: 6, height: 36 },
        { x: 7, y: 20, width: 86, height: 4 },
      ],
    };

    overlay.show(target, grid, 'div.grid');
    const border = root.querySelector<HTMLElement>('.overlay-border')!;
    expect(border.style.left).toBe('10px');
    expect(border.style.width).toBe('100px');
    const padding = root.querySelector<HTMLElement>('.overlay-padding')!;
    expect(padding.style.left).toBe('12px');
    expect(padding.style.width).toBe('96px');
    const content = root.querySelector<HTMLElement>('.overlay-content')!;
    expect(content.style.left).toBe('17px');
    expect(content.style.width).toBe('86px');
    const gaps = () =>
      Array.from(root.querySelectorAll<HTMLElement>('.overlay-gap'));
    expect(gaps()).toHaveLength(2);
    expect(gaps()[0]!.style.left).toBe('50px');
    expect(gaps()[0]!.style.top).toBe('17px');
    expect(gaps()[1]!.style.width).toBe('86px');

    overlay.show(target, { ...grid, gaps: grid.gaps.slice(0, 1) }, 'div.grid');
    expect(gaps().map((gap) => gap.hidden)).toEqual([false, true]);

    overlay.setBoxModel(false);
    overlay.show(target, grid, 'div.grid');
    expect(border.hidden).toBe(true);
    expect(gaps().every((gap) => gap.hidden)).toBe(true);
  });
});
