import { DevServer, SourceInfo, SourceOrigin } from '../../types';
import { parentOf } from '../dom/dom';

const LOCATION = /^(.*?):(\d+)(?::(\d+))?(?::[^:]*)?$/;
const ANCESTOR_LIMIT = 4;

export function parseLocation(
  value: string,
  origin: SourceOrigin,
): SourceInfo | null {
  const match = LOCATION.exec(value.trim());
  if (!match) {
    return value.trim()
      ? { file: value.trim(), line: null, column: null, origin, mapped: true }
      : null;
  }
  const [, file, line, column] = match;
  if (!file) return null;
  return {
    file,
    line: Number(line),
    column: column ? Number(column) : null,
    origin,
    mapped: true,
  };
}

function readMarker(el: Element): SourceInfo | null {
  const qwik = el.getAttribute('data-qwik-inspector');
  if (qwik) return parseLocation(qwik, 'qwik');

  const vue = el.getAttribute('data-v-inspector');
  if (vue) return parseLocation(vue, 'vue');

  const inspector = el.getAttribute('data-insp-path');
  if (inspector) return parseLocation(inspector, 'inspector');

  const astroFile = el.getAttribute('data-astro-source-file');
  if (astroFile) {
    const loc = el.getAttribute('data-astro-source-loc') ?? '';
    return parseLocation(loc ? `${astroFile}:${loc}` : astroFile, 'astro');
  }

  const reactPath = el.getAttribute('data-inspector-relative-path');
  if (reactPath) {
    const line = el.getAttribute('data-inspector-line');
    const column = el.getAttribute('data-inspector-column');
    return {
      file: reactPath,
      line: line ? Number(line) : null,
      column: column ? Number(column) : null,
      origin: 'react',
      mapped: true,
    };
  }

  return null;
}

export function getAttributeSource(el: Element): SourceInfo | null {
  let current: Element | null = el;
  for (let depth = 0; current && depth <= ANCESTOR_LIMIT; depth += 1) {
    const found = readMarker(current);
    if (found) return found;
    current = parentOf(current);
  }
  return null;
}

export function viteBase(): string {
  const src = viteClient()?.getAttribute('src') ?? '/@vite/client';
  return src.slice(0, src.indexOf('@vite/client'));
}

function viteClient(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>(
    'script[src*="/@vite/client"]',
  );
}

export function detectDevServer(): DevServer {
  if (viteClient()) return 'vite';
  if (document.querySelector('script[src*="/_next/static/"]')) return 'next';
  return null;
}

export function formatSource(source: SourceInfo): string {
  const parts = [source.file];
  if (source.line !== null) parts.push(source.line.toString());
  if (source.column !== null) parts.push(source.column.toString());
  return parts.join(':');
}

export function editorUrl(
  source: SourceInfo,
  server: DevServer,
): string | null {
  if (server === 'vite') {
    return `${viteBase()}__open-in-editor?file=${encodeURIComponent(formatSource(source))}`;
  }
  if (server === 'next') {
    const params = new URLSearchParams({
      file: source.file,
      lineNumber: (source.line ?? 1).toString(),
      column: (source.column ?? 1).toString(),
    });
    return `/__nextjs_launch-editor?${params.toString()}`;
  }
  return null;
}

interface NextFrameResult {
  value?: {
    originalStackFrame?: {
      file?: string | null;
      line1?: number | null;
      column1?: number | null;
    } | null;
  };
}

export async function resolveNextFrame(
  source: SourceInfo,
): Promise<SourceInfo | null> {
  if (source.line === null || source.column === null) return null;
  const isClient = source.file.startsWith('_next/');
  const frame = {
    file: isClient ? `/${source.file}` : source.file,
    line1: source.line,
    column1: source.column,
    lineNumber: source.line,
    column: source.column,
    methodName: '',
    arguments: [],
  };
  try {
    const response = await fetch('/__nextjs_original-stack-frames', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        frames: [frame],
        isServer: !isClient,
        isEdgeServer: false,
        isAppDirectory: true,
      }),
    });
    if (!response.ok) return null;
    const results = (await response.json()) as NextFrameResult[];
    const original = results.at(0)?.value?.originalStackFrame;
    if (!original?.file || typeof original.line1 !== 'number') return null;
    return {
      file: original.file,
      line: original.line1,
      column: typeof original.column1 === 'number' ? original.column1 : null,
      origin: 'react',
      mapped: true,
    };
  } catch {
    return null;
  }
}

export async function openInEditor(
  source: SourceInfo,
  server: DevServer,
): Promise<boolean> {
  const url = editorUrl(source, server);
  if (!url) return false;
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}
