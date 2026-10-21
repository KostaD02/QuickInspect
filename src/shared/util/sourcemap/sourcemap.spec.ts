import {
  decodeMappings,
  externalMapUrl,
  mapToOriginal,
  originalPosition,
  parseSourceMap,
} from './sourcemap';

const map = {
  sources: ['App.tsx'],
  mappings: 'AAAA;AACA,IAAI;QACI,CAAC',
};

describe('sourcemap', () => {
  it('decodes vlq mappings into segments', () => {
    const lines = decodeMappings(map.mappings);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([
      { generatedColumn: 0, source: 0, line: 1, column: 0 },
      { generatedColumn: 4, source: 0, line: 1, column: 4 },
    ]);
  });

  it('maps a generated position to the nearest original segment', () => {
    expect(originalPosition(map, 2, 7)).toEqual({
      file: 'App.tsx',
      line: 2,
      column: 5,
    });
    expect(originalPosition(map, 3, 1)).toEqual({
      file: 'App.tsx',
      line: 3,
      column: 9,
    });
    expect(originalPosition(map, 3, 10)).toEqual({
      file: 'App.tsx',
      line: 3,
      column: 10,
    });
    expect(originalPosition(map, 9, 1)).toBeNull();
    expect(originalPosition({ ...map, sourceRoot: 'src/' }, 1, 1)?.file).toBe(
      'src/App.tsx',
    );
  });

  it('maps through the sections of an index map', () => {
    const index = {
      sections: [
        { offset: { line: 0, column: 0 }, map },
        {
          offset: { line: 3, column: 4 },
          map: {
            sources: ['turbopack:///[project]/app/page.tsx'],
            mappings: 'AAAA,IAAI;AACA,IAAI',
          },
        },
      ],
    };
    expect(originalPosition(index, 2, 7)).toEqual({
      file: 'App.tsx',
      line: 2,
      column: 5,
    });
    expect(originalPosition(index, 4, 5)).toEqual({
      file: 'turbopack:///[project]/app/page.tsx',
      line: 1,
      column: 1,
    });
    expect(originalPosition(index, 4, 9)?.column).toBe(5);
    expect(originalPosition(index, 5, 5)).toMatchObject({ line: 2, column: 9 });
    expect(originalPosition({ sections: [] }, 1, 1)).toBeNull();
  });

  it('reads inline and external source map references', () => {
    const inline = `code();\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(map))}`;
    expect(parseSourceMap(inline)).toMatchObject({ sources: ['App.tsx'] });
    expect(
      parseSourceMap('//# sourceMappingURL=data:application/json;base64,@@@'),
    ).toBeNull();
    expect(externalMapUrl('code();\n//# sourceMappingURL=App.tsx.map\n')).toBe(
      'App.tsx.map',
    );
    expect(externalMapUrl('code();')).toBeNull();
  });

  it('fetches the module, applies the map and resolves the source path', async () => {
    const inline = `code();\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify({ ...map, sources: ['../lib/App.tsx'] }))}`;
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(inline),
      } as Response),
    );
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });
    const source = {
      file: 'src/app/App.tsx',
      line: 2,
      column: 7,
      origin: 'react' as const,
      mapped: false,
    };
    expect(await mapToOriginal(source, '/base/')).toEqual({
      ...source,
      file: 'src/lib/App.tsx',
      line: 2,
      column: 5,
    });
    expect(fetchMock).toHaveBeenCalledWith('/base/src/app/App.tsx');
    await mapToOriginal(source, '/base/');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await mapToOriginal({ ...source, line: null }, '/base/')).toBeNull();
  });

  it('follows an external map and turns turbopack sources into paths', async () => {
    const external = {
      sources: [
        'file:///C:/My%20App/app/page.tsx',
        'turbopack:///[project]/app/probe.tsx',
      ],
      mappings: 'AAAA;ACAA',
    };
    const fetchMock = jest.fn((url: string) =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('code();\n//# sourceMappingURL=c._.js.map'),
        json: () => Promise.resolve(url.endsWith('.map') ? external : null),
      } as Response),
    );
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });
    const source = {
      file: '_next/static/chunks/c._.js',
      line: 1,
      column: 1,
      origin: 'react' as const,
      mapped: false,
    };
    expect((await mapToOriginal(source))?.file).toBe('C:/My App/app/page.tsx');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost/_next/static/chunks/c._.js.map',
    );
    expect((await mapToOriginal({ ...source, line: 2 }))?.file).toBe(
      'app/probe.tsx',
    );
  });

  it('returns null when the module has no map or cannot be fetched', async () => {
    const fetchMock = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('code();'),
      } as Response),
    );
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });
    const source = {
      file: 'nomap.ts',
      line: 1,
      column: 1,
      origin: 'react' as const,
      mapped: false,
    };
    expect(await mapToOriginal(source)).toBeNull();
    fetchMock.mockImplementation(() => Promise.reject(new Error('down')));
    expect(await mapToOriginal({ ...source, file: 'down.ts' })).toBeNull();
  });
});
