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

  it('reads inline and external source map references', () => {
    const inline = `code();\n//# sourceMappingURL=data:application/json;base64,${btoa(JSON.stringify(map))}`;
    expect(parseSourceMap(inline)?.sources).toEqual(['App.tsx']);
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
