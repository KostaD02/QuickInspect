import { BoxEdges, Rect } from '../../types';

interface Span {
  start: number;
  end: number;
}

interface Item {
  main: Span;
  cross: Span;
}

interface Line {
  items: Item[];
  cross: Span;
}

export interface GapContext {
  rect: DOMRect;
  border: BoxEdges;
  padding: BoxEdges;
}

// ? the slack allowed when two edges are compared, since layout sizes are fractional
const EPSILON = 0.5;

function gapLength(value: string): number {
  return parseFloat(value) || 0;
}

export function readGap(
  style: CSSStyleDeclaration,
): { row: number; column: number } | null {
  const display = style.getPropertyValue('display');
  if (!display.includes('flex') && !display.includes('grid')) return null;
  return {
    row: gapLength(style.getPropertyValue('row-gap')),
    column: gapLength(style.getPropertyValue('column-gap')),
  };
}

function contentBox({ rect, border, padding }: GapContext): Rect {
  const x = border.left + padding.left;
  const y = border.top + padding.top;
  return {
    x,
    y,
    width: Math.max(0, rect.width - x - border.right - padding.right),
    height: Math.max(0, rect.height - y - border.bottom - padding.bottom),
  };
}

// ? resolved grid templates list every track in px, with line names in brackets
function tracks(value: string): number[] {
  return value
    .replace(/\[[^\]]*\]/g, ' ')
    .trim()
    .split(/\s+/)
    .map(parseFloat)
    .filter((size) => !Number.isNaN(size));
}

function trackOffset(free: number, align: string): number {
  if (free <= 0) return 0;
  if (align.includes('center')) return free / 2;
  if (/end|right/.test(align)) return free;
  return 0;
}

// ? where each gap between consecutive tracks starts, from the content box's leading edge
function trackGaps(sizes: number[], gap: number, offset: number): number[] {
  const starts: number[] = [];
  let position = offset;
  sizes.slice(0, -1).forEach((size) => {
    position += size;
    starts.push(position);
    position += gap;
  });
  return starts;
}

function gridGaps(
  style: CSSStyleDeclaration,
  content: Rect,
  gap: { row: number; column: number },
): Rect[] {
  const columns = tracks(style.getPropertyValue('grid-template-columns'));
  const rows = tracks(style.getPropertyValue('grid-template-rows'));
  const sum = (sizes: number[], between: number) =>
    sizes.reduce((total, size) => total + size, 0) +
    between * Math.max(0, sizes.length - 1);
  const width = sum(columns, gap.column);
  const height = rows.length ? sum(rows, gap.row) : content.height;
  const left = trackOffset(
    content.width - width,
    style.getPropertyValue('justify-content'),
  );
  const top = trackOffset(
    content.height - height,
    style.getPropertyValue('align-content'),
  );
  const rtl = style.getPropertyValue('direction') === 'rtl';
  const result: Rect[] = [];
  if (gap.column > 0) {
    for (const start of trackGaps(columns, gap.column, left)) {
      result.push({
        x: content.x + (rtl ? content.width - start - gap.column : start),
        y: content.y + top,
        width: gap.column,
        height,
      });
    }
  }
  if (gap.row > 0) {
    for (const start of trackGaps(rows, gap.row, top)) {
      result.push({
        x: content.x + (rtl ? content.width - left - width : left),
        y: content.y + start,
        width: columns.length ? width : content.width,
        height: gap.row,
      });
    }
  }
  return result;
}

function inFlow(child: Element): boolean {
  const position = getComputedStyle(child).getPropertyValue('position');
  return position !== 'absolute' && position !== 'fixed';
}

// ? an item starts a new line once it no longer shares the cross axis with the current one
function flexLines(items: Item[]): Line[] {
  const lines: Line[] = [];
  for (const item of items) {
    const line = lines.at(-1);
    if (
      line &&
      item.cross.start < line.cross.end - EPSILON &&
      item.cross.end > line.cross.start + EPSILON
    ) {
      line.items.push(item);
      line.cross = {
        start: Math.min(line.cross.start, item.cross.start),
        end: Math.max(line.cross.end, item.cross.end),
      };
    } else {
      lines.push({ items: [item], cross: { ...item.cross } });
    }
  }
  return lines;
}

// ? the gap sits in the middle of the space between two neighbours, so free space from justify-content stays outside it
function between(before: Span, after: Span, gap: number): Span | null {
  const space = after.start - before.end;
  if (gap <= 0 || space < gap - EPSILON) return null;
  const start = before.end + (space - gap) / 2;
  return { start, end: start + gap };
}

function flexGaps(
  el: Element,
  style: CSSStyleDeclaration,
  context: GapContext,
  content: Rect,
  gap: { row: number; column: number },
): Rect[] {
  const row = !style.getPropertyValue('flex-direction').startsWith('column');
  const mainGap = row ? gap.column : gap.row;
  const crossGap = row ? gap.row : gap.column;
  const { rect } = context;
  const items: Item[] = Array.from(el.children)
    .filter(inFlow)
    .map((child) => {
      const box = child.getBoundingClientRect();
      const x = { start: box.left - rect.left, end: box.right - rect.left };
      const y = { start: box.top - rect.top, end: box.bottom - rect.top };
      return row ? { main: x, cross: y } : { main: y, cross: x };
    })
    .filter((item) => item.main.end > item.main.start);

  const toRect = (main: Span, cross: Span): Rect =>
    row
      ? {
          x: main.start,
          y: cross.start,
          width: main.end - main.start,
          height: cross.end - cross.start,
        }
      : {
          x: cross.start,
          y: main.start,
          width: cross.end - cross.start,
          height: main.end - main.start,
        };

  const lines = flexLines(items);
  const result: Rect[] = [];
  for (const line of lines) {
    const ordered = [...line.items].sort((a, b) => a.main.start - b.main.start);
    ordered.slice(1).forEach((item, index) => {
      const span = between(ordered[index].main, item.main, mainGap);
      if (span) result.push(toRect(span, line.cross));
    });
  }
  const contentMain = row
    ? { start: content.x, end: content.x + content.width }
    : { start: content.y, end: content.y + content.height };
  const stacked = [...lines].sort((a, b) => a.cross.start - b.cross.start);
  stacked.slice(1).forEach((line, index) => {
    const span = between(stacked[index].cross, line.cross, crossGap);
    if (span) result.push(toRect(contentMain, span));
  });
  return result;
}

export function getGaps(
  el: Element,
  style: CSSStyleDeclaration,
  context: GapContext,
): Rect[] {
  const gap = readGap(style);
  if (!gap || (gap.row <= 0 && gap.column <= 0)) return [];
  const content = contentBox(context);
  return style.getPropertyValue('display').includes('grid')
    ? gridGaps(style, content, gap)
    : flexGaps(el, style, context, content, gap);
}
