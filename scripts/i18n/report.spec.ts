import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildReport, MARKER, markdown, run } from './report';

type Bundle = Record<
  string,
  {
    message: string;
    description?: string;
    placeholders?: Record<string, { content: string }>;
  }
>;

const count = { COUNT: { content: '$1' } };
const en: Bundle = {
  appName: { message: 'QuickInspect', description: 'Name.' },
  appDescription: { message: 'Inspect elements.', description: 'Description.' },
  settingsReset: { message: 'Reset to defaults', description: 'Button.' },
  editorHint: {
    message: 'Press <kbd class="k">O</kbd> to open.',
    description: 'Hint.',
  },
  listeners_one: {
    message: '$COUNT$ listener',
    description: 'One.',
    placeholders: count,
  },
  listeners_other: {
    message: '$COUNT$ listeners',
    description: 'Other.',
    placeholders: count,
  },
};
const de: Bundle = {
  appName: { message: 'QuickInspect' },
  appDescription: { message: 'Elemente untersuchen.' },
  settingsReset: { message: 'Auf Standard zurücksetzen' },
  editorHint: { message: 'Drücke <kbd class="k">O</kbd> zum Öffnen.' },
  listeners_one: { message: '$COUNT$ Listener', placeholders: count },
  listeners_other: { message: '$COUNT$ Listener', placeholders: count },
};

describe('i18n report', () => {
  let root: string;
  const out = { log: jest.fn(), error: jest.fn() };

  function write(locale: string, bundle: Bundle | string): void {
    const dir = path.join(root, '_locales', locale);
    mkdirSync(dir, { recursive: true });
    const text = typeof bundle === 'string' ? bundle : JSON.stringify(bundle);
    writeFileSync(path.join(dir, 'messages.json'), text);
  }

  function problems(): string[] {
    return buildReport(root, {}).problems;
  }

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'i18n-report-'));
    out.log.mockClear();
    out.error.mockClear();
    write('en', en);
    write('de', de);
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('writes the markdown and json reports and succeeds on a clean set', () => {
    expect(
      run(root, { I18N_COMMIT_SHA: 'abcdef1234', PR_COMMIT_COUNT: '3' }, out),
    ).toBe(0);
    const json = JSON.parse(
      readFileSync(path.join(root, 'tmp/i18n-report.json'), 'utf8'),
    );
    const md = readFileSync(path.join(root, 'tmp/i18n-report.md'), 'utf8');
    expect(json.total).toBe(5);
    expect(json.problems).toEqual([]);
    expect(json.locales.map((row: { locale: string }) => row.locale)).toEqual([
      'en',
      'de',
    ]);
    expect(json.locales[1]).toMatchObject({
      language: 'German',
      native: 'Deutsch',
      direction: 'ltr',
      translated: 5,
      percent: 100,
    });
    expect(md.startsWith(MARKER)).toBe(true);
    expect(md).toContain('**Latest - abcdef1 · build N3**');
    expect(md).toContain(
      '| `de` | Deutsch · German | 5/5 (100%) | ██████████ |',
    );
    expect(md).not.toContain('### Problems');
    expect(out.log).toHaveBeenCalledWith(
      expect.stringContaining('2 locales, 5 messages in en'),
    );
    expect(out.error).not.toHaveBeenCalled();
  });

  it('counts coverage per base key and marks right-to-left languages', () => {
    const partial = Object.fromEntries(
      Object.entries(de).filter(([key]) => !key.startsWith('listeners_')),
    );
    write('ar', { ...partial, appDescription: { message: 'فحص العناصر.' } });
    const report = buildReport(root, {});
    const ar = report.locales.find((row) => row.locale === 'ar');
    expect(ar).toMatchObject({
      direction: 'rtl',
      translated: 4,
      total: 5,
      percent: 80,
    });
    expect(report.problems).toEqual([]);
    expect(markdown(report)).toContain(
      '| `ar` | العربية · Arabic · RTL | 4/5 (80%) | ████████░░ |',
    );
    expect(report.build).toBeUndefined();
  });

  it('fails on orphan keys, placeholder and markup mismatches and lone dollar signs', () => {
    write('de', {
      ...de,
      extraKey: { message: 'x' },
      listeners_other: {
        message: '$N$ Listener',
        placeholders: { N: { content: '$1' } },
      },
      editorHint: { message: 'Drücke <b>O</b> zum Öffnen.' },
      settingsReset: { message: 'Kostet 5$' },
      appName: { message: '' },
    });
    expect(problems()).toEqual([
      'de/appName: empty message',
      'de/settingsReset: lone $ (write $$ for a literal dollar sign)',
      'de/editorHint: markup differs from en',
      'de/listeners_other: placeholders [N] differ from en [COUNT]',
      'de/extraKey: not a message of en',
    ]);
    expect(run(root, {}, out)).toBe(1);
    expect(out.error).toHaveBeenCalledWith('\n5 problem(s):');
    expect(
      readFileSync(path.join(root, 'tmp/i18n-report.md'), 'utf8'),
    ).toContain('### Problems');
  });

  it('reports an undeclared placeholder', () => {
    write('de', { ...de, listeners_one: { message: '$COUNT$ Listener' } });
    expect(problems()).toEqual([
      'de/listeners_one: $COUNT$ is not declared in placeholders',
    ]);
  });

  it('requires every CLDR plural form a language can select and no others', () => {
    write('ru', {
      ...de,
      listeners_one: { message: '$COUNT$ слушатель', placeholders: count },
    });
    write('ja', {
      ...de,
      listeners_one: { message: '$COUNT$ 件', placeholders: count },
    });
    expect(problems()).toEqual([
      'ja/listeners: plural forms one are never selected for ja',
      'ru/listeners: missing plural forms many, few',
    ]);
  });

  it('enforces the manifest limits on the name and description', () => {
    write('de', {
      ...de,
      appName: { message: 'Q'.repeat(46) },
      appDescription: { message: 'D'.repeat(133) },
    });
    expect(problems()).toEqual([
      'de/appName: 46 characters, Chrome allows 45',
      'de/appDescription: 133 characters, Chrome allows 132',
    ]);
  });

  it('checks the default locale for names and descriptions', () => {
    write('en', {
      ...en,
      '1bad': { message: 'x', description: 'd' },
      SETTINGSRESET: { message: 'y' },
    });
    rmSync(path.join(root, '_locales/de'), { recursive: true });
    expect(problems()).toEqual([
      'en/1bad: invalid message name',
      'en/SETTINGSRESET: clashes with another name when compared case-insensitively',
      'en/SETTINGSRESET: missing description',
    ]);
  });

  it('tolerates an empty or broken locale folder with a readable problem', () => {
    mkdirSync(path.join(root, '_locales/fr'));
    write('it', '{ not json');
    const report = buildReport(root, {});
    expect(report.problems).toEqual([
      'fr/messages.json: missing or not valid JSON',
      'it/messages.json: missing or not valid JSON',
    ]);
    expect(report.locales.find((row) => row.locale === 'fr')).toMatchObject({
      translated: 0,
      percent: 0,
    });
    expect(run(root, {}, out)).toBe(1);
  });

  it('stops with a message instead of a stack trace when the default locale is missing', () => {
    rmSync(path.join(root, '_locales'), { recursive: true });
    expect(run(root, {}, out)).toBe(1);
    expect(out.error).toHaveBeenCalledWith(
      `_locales/en/messages.json is missing in ${root}`,
    );
    expect(existsSync(path.join(root, 'tmp'))).toBe(false);

    mkdirSync(path.join(root, '_locales/en'), { recursive: true });
    expect(run(root, {}, out)).toBe(1);
  });
});
