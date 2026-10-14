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
});
