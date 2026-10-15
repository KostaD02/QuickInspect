import { SourceInfo } from '../../types';

const BASE64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INLINE_MAP =
  /\/\/[#@]\s*sourceMappingURL=data:application\/json[^,]*;base64,([A-Za-z0-9+/=]+)/;
const EXTERNAL_MAP = /\/\/[#@]\s*sourceMappingURL=(\S+)\s*$/;

interface RawSourceMap {
  sources: string[];
  sourceRoot?: string;
  mappings: string;
}

interface Segment {
  generatedColumn: number;
  source: number;
  line: number;
  column: number;
}

function decodeVlq(text: string): number[] {
  const values: number[] = [];
  let shift = 0;
  let value = 0;
  for (const char of text) {
    const digit = BASE64.indexOf(char);
    if (digit < 0) break;
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
      continue;
    }
    values.push(value & 1 ? -(value >> 1) : value >> 1);
    shift = 0;
    value = 0;
  }
  return values;
}

export function decodeMappings(mappings: string): Segment[][] {
  const lines: Segment[][] = [];
  let source = 0;
  let line = 0;
  let column = 0;
  for (const rawLine of mappings.split(';')) {
    const segments: Segment[] = [];
    let generatedColumn = 0;
    for (const rawSegment of rawLine.split(',')) {
      if (!rawSegment) continue;
      const fields = decodeVlq(rawSegment);
      generatedColumn += fields[0] ?? 0;
      if (fields.length < 4) continue;
      source += fields[1] ?? 0;
      line += fields[2] ?? 0;
      column += fields[3] ?? 0;
      segments.push({ generatedColumn, source, line, column });
    }
    lines.push(segments);
  }
  return lines;
}

export function originalPosition(
  map: RawSourceMap,
  generatedLine: number,
  generatedColumn: number,
): { file: string; line: number; column: number } | null {
  const segments = decodeMappings(map.mappings).at(generatedLine - 1) ?? [];
  let best: Segment | undefined;
  for (const segment of segments) {
    if (!best || segment.generatedColumn <= generatedColumn - 1) {
      best = segment;
    }
  }
  const source = best ? map.sources.at(best.source) : undefined;
  if (!best || source === undefined) return null;
  return {
    file: `${map.sourceRoot ?? ''}${source}`,
    line: best.line + 1,
    column: best.column + 1,
  };
}

export function parseSourceMap(moduleText: string): RawSourceMap | null {
  const inline = INLINE_MAP.exec(moduleText);
  if (!inline?.[1]) return null;
  try {
    return JSON.parse(atob(inline[1])) as RawSourceMap;
  } catch {
    return null;
  }
}

export function externalMapUrl(moduleText: string): string | null {
  return EXTERNAL_MAP.exec(moduleText.trimEnd())?.[1] ?? null;
}

function resolveSourcePath(moduleFile: string, mapped: string): string {
  if (mapped.startsWith('/') || /^[A-Za-z]:/.test(mapped)) return mapped;
  const dir = moduleFile.includes('/')
    ? moduleFile.slice(0, moduleFile.lastIndexOf('/') + 1)
    : '';
  const parts = `${dir}${mapped}`.split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return out.join('/');
}

const cache = new Map<string, Promise<RawSourceMap | null>>();

async function loadMap(url: string): Promise<RawSourceMap | null> {
  const response = await fetch(url);
  if (!response.ok) return null;
  const text = await response.text();
  const inline = parseSourceMap(text);
  if (inline) return inline;
  const external = externalMapUrl(text);
  if (!external) return null;
  const mapResponse = await fetch(new URL(external, url).toString());
  return mapResponse.ok ? ((await mapResponse.json()) as RawSourceMap) : null;
}

export async function mapToOriginal(
  source: SourceInfo,
  base = '/',
): Promise<SourceInfo | null> {
  if (source.line === null || source.column === null) return null;
  const url = `${base}${source.file}`;
  let pending = cache.get(url);
  if (!pending) {
    pending = loadMap(url).catch(() => null);
    cache.set(url, pending);
  }
  const map = await pending;
  if (!map) return null;
  const position = originalPosition(map, source.line, source.column);
  if (!position) return null;
  return {
    ...source,
    file: resolveSourcePath(source.file, position.file),
    line: position.line,
    column: position.column,
  };
}
