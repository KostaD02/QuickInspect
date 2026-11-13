import { BoxEdges, ElementInfo } from '@/shared/types';
import { round } from '../format/format';
import { bestLocator } from '../locator/locator';

type Row = [string, string];

const code = (value: string): string => `\`${value.replace(/`/g, '\\`')}\``;
const edges = (box: BoxEdges): string =>
  [box.top, box.right, box.bottom, box.left].map(round).join(' ');
const list = (rows: Row[]): string =>
  rows.map(([key, value]) => `- ${key}: ${value}`).join('\n');
const section = (title: string, rows: Row[]): string =>
  rows.length ? `### ${title}\n${list(rows)}` : '';

export function toJson(info: ElementInfo): string {
  return JSON.stringify(info, null, 2);
}

export function toMarkdown(info: ElementInfo): string {
  const { box, accessibility: a11y } = info;
  const best = bestLocator(info.locators);
  const parts = [
    `## ${info.summary}`,
    list([
      ['Selector', code(info.selector)],
      ['XPath', code(info.xpath)],
      ...(best ? [['Locator', code(best.code)] as Row] : []),
    ]),
    section('Box', [
      ['Position', `${String(round(box.x))}, ${String(round(box.y))}`],
      ['Size', `${String(round(box.width))} × ${String(round(box.height))}`],
      ['Margin', edges(box.margin)],
      ['Padding', edges(box.padding)],
      ['Border', edges(box.border)],
    ]),
    section(
      'Styles',
      info.styles.map(({ property, value }) => [property, code(value)]),
    ),
    section('Accessibility', [
      ['Role', a11y.role || 'none'],
      ['Name', a11y.name ? code(a11y.name) : 'empty'],
      ['Focusable', a11y.focusable ? 'yes' : 'no'],
      ...a11y.aria.map(({ name, value }): Row => [name, code(value)]),
    ]),
    section(
      'Attributes',
      info.attributes.map(({ name, value }) => [name, code(value)]),
    ),
    info.text ? `### Text\n${info.text}` : '',
  ];
  return parts.filter(Boolean).join('\n\n');
}
