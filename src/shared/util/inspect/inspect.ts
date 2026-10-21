import {
  AttributeEntry,
  BoxEdges,
  BoxInfo,
  ContextEntry,
  ElementInfo,
  MediaInfo,
  StyleEntry,
} from '../../types';
import { getAccessibility } from '../a11y/a11y';
import { parentOf } from '../dom/dom';
import { probeEvents } from '../events/events';
import { getGaps, readGap } from '../gaps/gaps';
import { detectDevServer, getAttributeSource } from '../source/source';
import {
  isTransparent,
  round,
  squash,
  toHex,
  truncate,
} from '../format/format';
import { getLocators } from '../locator/locator';
import { getCssSelector, getElementSummary } from '../selector/selector';
import { getXPath } from '../xpath/xpath';

const ALWAYS = [
  'display',
  'position',
  'font-family',
  'font-size',
  'font-weight',
  'line-height',
  'color',
];

const WHEN_NOT: Record<string, string[]> = {
  'z-index': ['auto'],
  opacity: ['1'],
  overflow: ['visible'],
  'background-color': ['rgba(0, 0, 0, 0)', 'transparent'],
  'border-radius': ['0px'],
  'box-shadow': ['none'],
  'letter-spacing': ['normal'],
  'text-align': ['start', 'left'],
  'text-transform': ['none'],
  cursor: ['auto', 'default'],
  'pointer-events': ['auto'],
  transform: ['none'],
  transition: ['all', 'all 0s ease 0s', 'none'],
  'white-space': ['normal'],
};

const FLEX = [
  'flex-direction',
  'justify-content',
  'align-items',
  'gap',
  'flex-wrap',
];
const GRID = ['grid-template-columns', 'grid-template-rows', 'gap'];
const CHILD = ['flex', 'order', 'align-self', 'grid-area'];
const CHILD_DEFAULTS: Record<string, string[]> = {
  flex: ['0 1 auto'],
  order: ['0'],
  'align-self': ['auto'],
  'grid-area': ['auto', 'auto / auto / auto / auto'],
};

const COLOR_PROPERTY = /color$/;

function edges(
  style: CSSStyleDeclaration,
  prefix: string,
  suffix = '',
): BoxEdges {
  const read = (side: string) =>
    round(
      parseFloat(style.getPropertyValue(`${prefix}-${side}${suffix}`)) || 0,
    );
  return {
    top: read('top'),
    right: read('right'),
    bottom: read('bottom'),
    left: read('left'),
  };
}

export function getBox(el: Element, style: CSSStyleDeclaration): BoxInfo {
  const rect = el.getBoundingClientRect();
  const padding = edges(style, 'padding');
  const border = edges(style, 'border', '-width');
  return {
    x: round(rect.left + window.scrollX),
    y: round(rect.top + window.scrollY),
    width: round(rect.width),
    height: round(rect.height),
    margin: edges(style, 'margin'),
    padding,
    border,
    gap: readGap(style),
    gaps: getGaps(el, style, { rect, border, padding }),
  };
}

function entry(property: string, value: string): StyleEntry {
  if (COLOR_PROPERTY.test(property) && value.startsWith('rgb')) {
    return { property, value: toHex(value), color: value };
  }
  return { property, value };
}

export function getStyles(
  el: Element,
  style: CSSStyleDeclaration,
): StyleEntry[] {
  const result: StyleEntry[] = [];

  for (const property of ALWAYS) {
    result.push(entry(property, style.getPropertyValue(property)));
  }

  for (const [property, defaults] of Object.entries(WHEN_NOT)) {
    const value = style.getPropertyValue(property);
    if (!value || defaults.includes(value)) continue;
    if (property === 'background-color' && isTransparent(value)) continue;
    result.push(entry(property, value));
  }

  const borderWidth =
    parseFloat(style.getPropertyValue('border-top-width')) || 0;
  if (borderWidth > 0) {
    result.push(entry('border', style.getPropertyValue('border-top')));
  }

  const display = style.getPropertyValue('display');
  const layout = display.includes('grid')
    ? GRID
    : display.includes('flex')
      ? FLEX
      : [];
  for (const property of layout) {
    result.push(entry(property, style.getPropertyValue(property)));
  }

  const parentDisplay = el.parentElement
    ? getComputedStyle(el.parentElement).getPropertyValue('display')
    : '';
  if (parentDisplay.includes('flex') || parentDisplay.includes('grid')) {
    for (const property of CHILD) {
      const value = style.getPropertyValue(property);
      if (value && !(CHILD_DEFAULTS[property] ?? []).includes(value)) {
        result.push(entry(property, value));
      }
    }
  }

  return result;
}

export function getAttributes(el: Element): AttributeEntry[] {
  return Array.from(el.attributes)
    .filter((attr) => attr.name !== 'style' || attr.value.length < 200)
    .map((attr) => ({ name: attr.name, value: truncate(attr.value, 200) }));
}

export function getAncestors(el: Element, limit = 4): ContextEntry[] {
  const chain: ContextEntry[] = [];
  let current = parentOf(el);
  let depth = 1;
  while (current && current !== document.documentElement && depth <= limit) {
    chain.push({ summary: getElementSummary(current), depth });
    current = parentOf(current);
    depth += 1;
  }
  return chain;
}

export function getMedia(el: Element): MediaInfo | null {
  if (el instanceof HTMLImageElement) {
    return {
      kind: 'image',
      source: el.currentSrc || el.src,
      naturalWidth: el.naturalWidth,
      naturalHeight: el.naturalHeight,
      alt: el.alt,
    };
  }
  if (el instanceof HTMLVideoElement) {
    return {
      kind: 'video',
      source: el.currentSrc || el.src,
      naturalWidth: el.videoWidth,
      naturalHeight: el.videoHeight,
      duration: el.duration,
    };
  }
  if (el instanceof HTMLAudioElement) {
    return {
      kind: 'audio',
      source: el.currentSrc || el.src,
      duration: el.duration,
    };
  }
  if (el instanceof HTMLCanvasElement) {
    return {
      kind: 'canvas',
      source: '',
      naturalWidth: el.width,
      naturalHeight: el.height,
    };
  }
  if (el instanceof SVGSVGElement) {
    return { kind: 'svg', source: el.getAttribute('viewBox') ?? '' };
  }
  return null;
}

export function inspectElement(el: Element): ElementInfo {
  const style = getComputedStyle(el);
  const root = el.getRootNode();
  const events = probeEvents(el);

  return {
    tag: el.localName,
    id: el.id,
    classes: Array.from(el.classList),
    summary: getElementSummary(el),
    text: truncate(squash(el.textContent), 120),
    selector: getCssSelector(el),
    xpath: getXPath(el),
    locators: getLocators(el),
    box: getBox(el, style),
    styles: getStyles(el, style),
    accessibility: getAccessibility(el),
    attributes: getAttributes(el),
    ancestors: getAncestors(el),
    shadowHost:
      root instanceof ShadowRoot ? getElementSummary(root.host) : null,
    childCount: el.childElementCount,
    media: getMedia(el),
    events,
    source: getAttributeSource(el) ?? events.source,
    devServer: detectDevServer(),
  };
}
