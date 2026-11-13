import { compareElements } from './compare';

function element(style: string): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('style', style);
  document.body.append(el);
  return el;
}

describe('compare', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('finds nothing between two identical elements', () => {
    const a = element('display: block; padding: 4px');
    const b = element('display: block; padding: 4px');
    expect(compareElements(a, b)).toEqual([]);
  });

  it('lists the box and style values that differ, side by side', () => {
    const a = element('display: flex; padding: 4px 8px');
    const b = element('display: block; padding: 4px; color: rgb(255, 0, 0)');
    const rows = compareElements(a, b);
    const row = (property: string) =>
      rows.find((entry) => entry.property === property);
    expect(row('padding')).toEqual({
      property: 'padding',
      value: '4 8 4 8',
      base: '4 4 4 4',
    });
    expect(row('display')).toEqual({
      property: 'display',
      value: 'flex',
      base: 'block',
    });
    expect(row('color')?.base).toBe('#ff0000');
    expect(row('size')).toBeUndefined();
  });

  it('reads a style only one side lists from the other side', () => {
    const a = element('opacity: 0.5; border: 2px solid rgb(0, 0, 0)');
    const b = element('opacity: 1; border-top: 0px none rgb(0, 0, 0)');
    const rows = compareElements(a, b);
    expect(rows.find((row) => row.property === 'opacity')).toEqual({
      property: 'opacity',
      value: '0.5',
      base: '1',
    });
    expect(rows.find((row) => row.property === 'border-width')).toEqual({
      property: 'border-width',
      value: '2 2 2 2',
      base: '0 0 0 0',
    });
    expect(rows.find((row) => row.property === 'border')?.value).toContain(
      '2px',
    );
  });
});
