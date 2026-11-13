import { BoxEdges, BoxInfo } from '@/shared/types';
import { getBox, getStyles, styleEntry } from '../inspect/inspect';

export interface CompareRow {
  property: string;
  value: string;
  base: string;
}

interface Side {
  style: CSSStyleDeclaration;
  box: BoxInfo;
  styles: Map<string, string>;
}

const edges = (box: BoxEdges): string =>
  [box.top, box.right, box.bottom, box.left].join(' ');

function boxValues(box: BoxInfo): [string, string][] {
  return [
    ['size', `${box.width.toString()} × ${box.height.toString()}`],
    ['margin', edges(box.margin)],
    ['padding', edges(box.padding)],
    ['border-width', edges(box.border)],
    [
      'gap',
      box.gap ? `${box.gap.row.toString()} ${box.gap.column.toString()}` : '',
    ],
  ];
}

function read(el: Element): Side {
  const style = getComputedStyle(el);
  return {
    style,
    box: getBox(el, style),
    styles: new Map(
      getStyles(el, style).map((entry) => [entry.property, entry.value]),
    ),
  };
}

// ? a style only listed for one element is read from the other's computed style, so both sides show a real value
function styleValue(side: Side, property: string): string {
  const listed = side.styles.get(property);
  if (listed !== undefined) return listed;
  const computed = property === 'border' ? 'border-top' : property;
  return styleEntry(property, side.style.getPropertyValue(computed)).value;
}

export function compareElements(el: Element, base: Element): CompareRow[] {
  const a = read(el);
  const b = read(base);
  const rows: CompareRow[] = [];
  const baseBox = new Map(boxValues(b.box));
  for (const [property, value] of boxValues(a.box)) {
    const other = baseBox.get(property) ?? '';
    if (value !== other) rows.push({ property, value, base: other });
  }
  const properties = new Set([...a.styles.keys(), ...b.styles.keys()]);
  for (const property of properties) {
    const value = styleValue(a, property);
    const other = styleValue(b, property);
    if (value !== other) rows.push({ property, value, base: other });
  }
  return rows;
}
