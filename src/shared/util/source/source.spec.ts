import {
  detectDevServer,
  displayPath,
  editorAvailability,
  editorUrl,
  formatSource,
  getAttributeSource,
  openInEditor,
  pageHasSources,
  parseLocation,
  resolveNextFrame,
} from './source';
import { PROBE_EVENT, REPLY_EVENT } from '@/shared/types/events';

function make(html: string): Element {
  document.body.innerHTML = html;
  return document.body.firstElementChild!;
}

const SOURCE_REPLY = JSON.stringify({
  listeners: [],
  framework: null,
  source: {
    file: 'App.svelte',
    line: 1,
    column: 1,
    origin: 'svelte',
    mapped: true,
  },
});

let stopBridge = (): void => undefined;

function answerProbes(answers: (el: Element) => boolean): Element[] {
  const probed: Element[] = [];
  const onProbe = (event: Event) => {
    const target = event.composedPath()[0] as Element;
    probed.push(target);
    if (answers(target)) {
      target.dispatchEvent(
        new CustomEvent(REPLY_EVENT, { detail: SOURCE_REPLY }),
      );
    }
  };
  document.addEventListener(PROBE_EVENT, onProbe, true);
  stopBridge = () => {
    document.removeEventListener(PROBE_EVENT, onProbe, true);
  };
  return probed;
}

describe('source markers', () => {
  afterEach(() => {
    stopBridge();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('parses file, line and column with optional trailing name', () => {
    expect(parseLocation('src/app.tsx:12:5', 'qwik')).toEqual({
      file: 'src/app.tsx',
      line: 12,
      column: 5,
      origin: 'qwik',
      mapped: true,
    });
    expect(parseLocation('C:\\code\\app.tsx:3', 'vue')).toEqual({
      file: 'C:\\code\\app.tsx',
      line: 3,
      column: null,
      origin: 'vue',
      mapped: true,
    });
    expect(parseLocation('/abs/Button.tsx:4:2:Button', 'inspector')?.file).toBe(
      '/abs/Button.tsx',
    );
    expect(parseLocation('plain.vue', 'vue')).toEqual({
      file: 'plain.vue',
      line: null,
      column: null,
      origin: 'vue',
      mapped: true,
    });
    expect(parseLocation('  ', 'vue')).toBeNull();
  });

  it('reads qwik, vue, code-inspector, astro and react-dev-inspector markers', () => {
    expect(
      getAttributeSource(
        make('<div data-qwik-inspector="src/routes/index.tsx:9:3"></div>'),
      ),
    ).toMatchObject({ origin: 'qwik', line: 9 });
    expect(
      getAttributeSource(
        make('<div data-v-inspector="pages/index.vue:2:1"></div>'),
      ),
    ).toMatchObject({ origin: 'vue', file: 'pages/index.vue' });
    expect(
      getAttributeSource(
        make('<div data-insp-path="/p/App.tsx:7:9:App"></div>'),
      ),
    ).toMatchObject({ origin: 'inspector', line: 7, column: 9 });
    expect(
      getAttributeSource(
        make(
          '<div data-astro-source-file="/p/index.astro" data-astro-source-loc="5:7"></div>',
        ),
      ),
    ).toEqual({
      file: '/p/index.astro',
      line: 5,
      column: 7,
      origin: 'astro',
      mapped: true,
    });
    expect(
      getAttributeSource(
        make('<div data-astro-source-file="/p/index.astro"></div>'),
      ),
    ).toMatchObject({ line: null });
    expect(
      getAttributeSource(
        make(
          '<div data-inspector-relative-path="src/A.tsx" data-inspector-line="3" data-inspector-column="4"></div>',
        ),
      ),
    ).toEqual({
      file: 'src/A.tsx',
      line: 3,
      column: 4,
      origin: 'react',
      mapped: true,
    });
  });

  it('resolves qwik root urls against the project root', () => {
    const source = getAttributeSource(
      make(
        '<div data-qwik-inspector="/src/components/starter/hero/hero.tsx:7:5"></div>',
      ),
    )!;
    expect(source.file).toBe('src/components/starter/hero/hero.tsx');
    expect(formatSource(source)).toBe(
      'src/components/starter/hero/hero.tsx:7:5',
    );
    expect(editorUrl(source, 'vite')).toBe(
      `/__open-in-editor?file=${encodeURIComponent('src/components/starter/hero/hero.tsx:7:5')}`,
    );
    expect(
      getAttributeSource(
        make('<div data-qwik-inspector="/@fs/D:/lib/hero.tsx:3:1"></div>'),
      )?.file,
    ).toBe('/@fs/D:/lib/hero.tsx');
  });

  it('walks a few ancestors and gives up after that', () => {
    const root = make(
      '<section data-qwik-inspector="a.tsx:1:1"><div><p><b><i><u id="deep"></u></i></b></p></div></section>',
    );
    expect(getAttributeSource(root.querySelector('#deep')!)).toBeNull();
    expect(getAttributeSource(root.querySelector('i')!)?.file).toBe('a.tsx');
  });

  it('detects vite and next dev servers', () => {
    expect(detectDevServer()).toBeNull();
    document.head.innerHTML =
      '<script type="module" src="/_next/static/chunks/main.js"></script>';
    expect(detectDevServer()).toBe('next');
    document.head.innerHTML =
      '<script type="module" src="/app/@vite/client"></script>';
    expect(detectDevServer()).toBe('vite');
  });

  it('detects vite from a dynamically imported client', () => {
    document.head.innerHTML = '';
    const entries = jest
      .spyOn(performance, 'getEntriesByType')
      .mockReturnValue([
        { name: 'http://localhost:5174/@vite/client' } as PerformanceEntry,
      ]);
    expect(detectDevServer()).toBe('vite');
    expect(
      editorUrl(
        {
          file: 'src/routes/+layout.svelte',
          line: 16,
          column: 1,
          origin: 'svelte',
          mapped: true,
        },
        'vite',
      ),
    ).toBe(
      `http://localhost:5174/__open-in-editor?file=${encodeURIComponent('src/routes/+layout.svelte:16:1')}`,
    );
    expect(entries).toHaveBeenCalledWith('resource');
    entries.mockRestore();
  });

  it('reports no element sources when no probe answers', () => {
    document.body.innerHTML = `<main>${'<p>plain</p>'.repeat(199)}</main>`;
    const elements = Array.from(document.body.querySelectorAll('*'));
    const probed = answerProbes(() => false);
    expect(pageHasSources()).toBe(false);
    expect(probed.length).toBeGreaterThanOrEqual(24);
    expect(probed.length).toBeLessThanOrEqual(32);
    expect(probed[0]).toBe(elements[0]);
    expect(elements.indexOf(probed.at(-1)!)).toBeGreaterThan(180);
    expect(editorAvailability()).toEqual({ server: null, sources: false });

    document.head.innerHTML =
      '<script type="module" src="/@vite/client"></script>';
    expect(editorAvailability()).toEqual({ server: 'vite', sources: false });

    document.body.innerHTML = '<main data-qwik-inspector="a.tsx:1:1"></main>';
    expect(editorAvailability()).toEqual({ server: 'vite', sources: true });
  });

  it('reports element sources when the bridge answers a probe', () => {
    document.body.innerHTML = '<main><p>plain</p></main>';
    answerProbes(() => true);
    expect(pageHasSources()).toBe(true);
  });

  it('looks past leading script and svg noise for element sources', () => {
    const noise =
      '<script></script>'.repeat(10) +
      '<svg><path></path><path></path><path></path><path></path></svg>'.repeat(
        4,
      );
    document.body.innerHTML = `${noise}<main><section><p id="real">real</p></section></main>`;
    const probed = answerProbes((el) => el.id === 'real');
    expect(pageHasSources()).toBe(true);
    expect(probed.some((el) => el.matches('script, svg *'))).toBe(false);
  });

  it('strips the vite filesystem prefix for display and editors', () => {
    expect(displayPath('/@fs/D:/Github/app/src/x.tsx')).toBe(
      'D:/Github/app/src/x.tsx',
    );
    expect(displayPath('/@fs/tmp/fw/qwik-lib/hero.tsx')).toBe(
      '/tmp/fw/qwik-lib/hero.tsx',
    );
    expect(displayPath('/@fs//home/me/app/src/x.tsx')).toBe(
      '/home/me/app/src/x.tsx',
    );
    expect(displayPath('src/x.tsx')).toBe('src/x.tsx');
    const source = parseLocation('/@fs/D:/Github/app/src/x.tsx:12:5', 'qwik')!;
    expect(source.file).toBe('/@fs/D:/Github/app/src/x.tsx');
    expect(formatSource(source)).toBe('D:/Github/app/src/x.tsx:12:5');
    expect(editorUrl(source, 'vite')).toBe(
      `/__open-in-editor?file=${encodeURIComponent('D:/Github/app/src/x.tsx:12:5')}`,
    );
  });

  it('builds editor urls per server and formats locations', () => {
    const source = {
      file: 'src/App.tsx',
      line: 4,
      column: 2,
      origin: 'react' as const,
      mapped: true,
    };
    expect(formatSource(source)).toBe('src/App.tsx:4:2');
    expect(formatSource({ ...source, column: null })).toBe('src/App.tsx:4');
    document.head.innerHTML =
      '<script type="module" src="/app/@vite/client"></script>';
    expect(editorUrl(source, 'vite')).toBe(
      '/app/__open-in-editor?file=src%2FApp.tsx%3A4%3A2',
    );
    document.head.innerHTML = '';
    expect(editorUrl(source, 'vite')).toBe(
      '/__open-in-editor?file=src%2FApp.tsx%3A4%3A2',
    );
    expect(editorUrl(source, 'next')).toBe(
      '/__nextjs_launch-editor?file=src%2FApp.tsx&line1=4&column1=2&lineNumber=4&column=2',
    );
    expect(editorUrl({ ...source, line: null, column: null }, 'next')).toBe(
      '/__nextjs_launch-editor?file=src%2FApp.tsx&line1=1&column1=1&lineNumber=1&column=1',
    );
    expect(editorUrl(source, null)).toBeNull();
  });

  it('resolves next frames through the dev server', async () => {
    const reply: {
      status: string;
      value: {
        originalStackFrame: {
          file: string;
          line1: number | null;
          column1: number | null;
        };
      };
    }[] = [
      {
        status: 'fulfilled',
        value: {
          originalStackFrame: { file: 'app/page.tsx', line1: 23, column1: 13 },
        },
      },
    ];
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(reply),
      } as Response),
    );
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });
    const server = {
      file: '/tmp/app/.next/dev/server/chunks/ssr/x.js',
      line: 102,
      column: 447,
      origin: 'react' as const,
      mapped: false,
    };
    expect(await resolveNextFrame(server)).toEqual({
      file: 'app/page.tsx',
      line: 23,
      column: 13,
      origin: 'react',
      mapped: true,
    });
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toMatchObject({
      isServer: true,
      frames: [{ file: server.file, line1: 102, column1: 447 }],
    });

    await resolveNextFrame({ ...server, file: '_next/static/chunks/app_x.js' });
    const [, clientInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(clientInit.body as string)).toMatchObject({
      isServer: false,
      frames: [{ file: '/_next/static/chunks/app_x.js' }],
    });

    reply[0]!.value.originalStackFrame = {
      file: 'x.js',
      line1: null,
      column1: null,
    };
    expect(await resolveNextFrame(server)).toMatchObject({ line: 23 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await resolveNextFrame({ ...server, line: 103 })).toBeNull();
    expect(await resolveNextFrame({ ...server, line: null })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const later = { ...server, line: 104 };
    fetchMock.mockImplementationOnce(() => Promise.reject(new Error('down')));
    expect(await resolveNextFrame(later)).toBeNull();
    expect(await resolveNextFrame(later)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(await resolveNextFrame(later)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('opens through fetch and reports the outcome', async () => {
    const source = {
      file: 'a.tsx',
      line: 1,
      column: 1,
      origin: 'react' as const,
      mapped: true,
    };
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });
    expect(await openInEditor(source, 'vite')).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      '/__open-in-editor?file=a.tsx%3A1%3A1',
    );
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    expect(await openInEditor(source, 'vite')).toBe(false);
    expect(await openInEditor(source, null)).toBe(false);
  });
});
