import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

interface Placeholder {
  content: string;
  example?: string;
}

interface Entry {
  message: string;
  description?: string;
  placeholders?: Record<string, Placeholder | undefined>;
}

type Bundle = Record<string, Entry | undefined>;

export interface LocaleRow {
  locale: string;
  language: string;
  native: string;
  direction: 'ltr' | 'rtl';
  translated: number;
  total: number;
  percent: number;
}

export interface BuildMeta {
  shortSha: string;
  buildNumber: string;
  updatedAt: string;
}

export interface Report {
  defaultLocale: string;
  total: number;
  locales: LocaleRow[];
  problems: string[];
  build?: BuildMeta;
}

type Output = Pick<Console, 'log' | 'error'>;

export const DEFAULT_LOCALE = 'en';
export const MARKER = '<!-- i18n-coverage-report -->';
const NAME_LIMIT = 45;
const DESCRIPTION_LIMIT = 132;
const RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur']);
const CATEGORY_ORDER = ['zero', 'one', 'two', 'few', 'many', 'other'];
const PLURAL = /_(zero|one|two|few|many|other)$/;

const baseOf = (key: string): string => key.replace(PLURAL, '');
const languageTag = (locale: string): string => locale.replace('_', '-');
const placeholdersIn = (text: string): string[] =>
  [...text.matchAll(/\$([A-Za-z0-9_]+)\$/g)]
    .map((match) => match[1].toUpperCase())
    .sort();
const tagsIn = (text: string): string[] =>
  [...text.matchAll(/<[^>]+>/g)].map((match) => match[0]).sort();

// ? a folder without a readable messages.json counts as untranslated instead of stopping the report
function readBundle(dir: string, locale: string, problems: string[]): Bundle {
  const file = path.join(dir, locale, 'messages.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Bundle;
  } catch {
    problems.push(`${locale}/messages.json: missing or not valid JSON`);
    return {};
  }
}

function displayName(locale: string, inLocale: string): string {
  try {
    const names = new Intl.DisplayNames([inLocale], { type: 'language' });
    return names.of(languageTag(locale)) ?? locale;
  } catch {
    return locale;
  }
}

// ? CLDR categories of the locale, and the ones an integer count can actually select
function pluralCategories(locale: string): {
  all: Set<string>;
  required: Set<string>;
} {
  const rules = new Intl.PluralRules(languageTag(locale));
  const all = new Set(rules.resolvedOptions().pluralCategories);
  const required = new Set<string>(['other']);
  for (let count = 0; count <= 1000; count += 1) {
    required.add(rules.select(count));
  }
  return { all, required };
}

function checkEntry(
  where: string,
  entry: Entry,
  reference: Entry,
  problems: string[],
): void {
  if (entry.message.trim() === '') {
    problems.push(`${where}: empty message`);
  }
  const want = placeholdersIn(reference.message);
  const have = placeholdersIn(entry.message);
  if (want.join(',') !== have.join(',')) {
    problems.push(
      `${where}: placeholders [${have.join(', ')}] differ from ${DEFAULT_LOCALE} [${want.join(', ')}]`,
    );
  }
  if (tagsIn(entry.message).join('|') !== tagsIn(reference.message).join('|')) {
    problems.push(`${where}: markup differs from ${DEFAULT_LOCALE}`);
  }
  const declared = Object.keys(entry.placeholders ?? {}).map((name) =>
    name.toUpperCase(),
  );
  for (const name of have) {
    if (!declared.includes(name)) {
      problems.push(`${where}: $${name}$ is not declared in placeholders`);
    }
  }
  const stripped = entry.message
    .replace(/\$[A-Za-z0-9_]+\$/g, '')
    .replace(/\$\$/g, '');
  if (stripped.includes('$')) {
    problems.push(`${where}: lone $ (write $$ for a literal dollar sign)`);
  }
}

function checkPlurals(
  locale: string,
  bundle: Bundle,
  problems: string[],
): void {
  const { all, required } = pluralCategories(locale);
  const bases = new Set(
    Object.keys(bundle)
      .filter((key) => PLURAL.test(key))
      .map(baseOf),
  );
  for (const base of bases) {
    const forms = CATEGORY_ORDER.filter((form) => `${base}_${form}` in bundle);
    const missing = [...required].filter((form) => !forms.includes(form));
    if (missing.length > 0) {
      problems.push(
        `${locale}/${base}: missing plural forms ${missing.join(', ')}`,
      );
    }
    const unused = forms.filter((form) => !all.has(form));
    if (unused.length > 0) {
      problems.push(
        `${locale}/${base}: plural forms ${unused.join(', ')} are never selected for ${locale}`,
      );
    }
  }
}

function checkLimits(locale: string, bundle: Bundle, problems: string[]): void {
  const name = bundle.appName?.message ?? '';
  const description = bundle.appDescription?.message ?? '';
  if (name.length > NAME_LIMIT) {
    problems.push(
      `${locale}/appName: ${String(name.length)} characters, Chrome allows ${String(NAME_LIMIT)}`,
    );
  }
  if (description.length > DESCRIPTION_LIMIT) {
    problems.push(
      `${locale}/appDescription: ${String(description.length)} characters, Chrome allows ${String(DESCRIPTION_LIMIT)}`,
    );
  }
}

function checkDefault(bundle: Bundle, problems: string[]): void {
  const seen = new Set<string>();
  for (const [key, entry] of Object.entries(bundle)) {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(key)) {
      problems.push(`${DEFAULT_LOCALE}/${key}: invalid message name`);
    }
    const lower = key.toLowerCase();
    if (seen.has(lower)) {
      problems.push(
        `${DEFAULT_LOCALE}/${key}: clashes with another name when compared case-insensitively`,
      );
    }
    seen.add(lower);
    if (!entry?.description) {
      problems.push(`${DEFAULT_LOCALE}/${key}: missing description`);
    }
  }
}

function analyseLocale(
  dir: string,
  locale: string,
  reference: Bundle,
  referenceBases: Set<string>,
  problems: string[],
): LocaleRow {
  const bundle =
    locale === DEFAULT_LOCALE ? reference : readBundle(dir, locale, problems);
  const bases = new Set(Object.keys(bundle).map(baseOf));

  if (locale !== DEFAULT_LOCALE) {
    for (const [key, entry] of Object.entries(bundle)) {
      if (!entry) continue;
      const ref = reference[key] ?? reference[`${baseOf(key)}_other`];
      if (!ref) {
        problems.push(`${locale}/${key}: not a message of ${DEFAULT_LOCALE}`);
        continue;
      }
      checkEntry(`${locale}/${key}`, entry, ref, problems);
    }
  }
  checkPlurals(locale, bundle, problems);
  checkLimits(locale, bundle, problems);

  const translated = [...referenceBases].filter((base) =>
    bases.has(base),
  ).length;
  const language = languageTag(locale).split('-')[0];
  return {
    locale,
    language: displayName(locale, 'en'),
    native: displayName(locale, languageTag(locale)),
    direction: RTL_LANGUAGES.has(language) ? 'rtl' : 'ltr',
    translated,
    total: referenceBases.size,
    percent:
      referenceBases.size === 0
        ? 0
        : Math.round((translated / referenceBases.size) * 100),
  };
}

function buildMeta(env: NodeJS.ProcessEnv): BuildMeta | undefined {
  const sha = env.I18N_COMMIT_SHA;
  if (!sha) return undefined;
  return {
    shortSha: sha.slice(0, 7),
    buildNumber: env.PR_COMMIT_COUNT ?? '-',
    updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
}

function bar(percent: number): string {
  const filled = Math.round(percent / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function coverage(row: LocaleRow): string {
  return `${String(row.translated)}/${String(row.total)} (${String(row.percent)}%)`;
}

export function markdown(report: Report): string {
  const lines = [MARKER, '## 🌍 i18n coverage', ''];
  if (report.build) {
    lines.push(
      `**Latest - ${report.build.shortSha} · build N${report.build.buildNumber}** _(updated ${report.build.updatedAt} UTC)_`,
      '',
    );
  }
  lines.push(
    `**${String(report.locales.length)} locales** ship with the extension. \`${report.defaultLocale}\` has **${String(report.total)} messages**.`,
    '',
    '| Locale | Language | Coverage | |',
    '| --- | --- | --- | --- |',
  );
  for (const row of report.locales) {
    const label =
      row.native === row.language
        ? row.language
        : `${row.native} · ${row.language}`;
    const direction = row.direction === 'rtl' ? ' · RTL' : '';
    lines.push(
      `| \`${row.locale}\` | ${label}${direction} | ${coverage(row)} | ${bar(row.percent)} |`,
    );
  }
  lines.push(
    '',
    `Chrome falls back from a region (\`pt_BR\`) to its language (\`pt\`) and then to \`${report.defaultLocale}\`, so a missing message shows in English.`,
  );
  if (report.problems.length > 0) {
    lines.push('', '### Problems', '');
    for (const problem of report.problems) lines.push(`- ${problem}`);
  }
  lines.push(
    '',
    '> [!TIP]',
    '> Run `pnpm i18n:report` locally to get this table before pushing.',
  );
  return `${lines.join('\n')}\n`;
}

function print(report: Report, out: Output): void {
  const width = Math.max(...report.locales.map((row) => row.locale.length));
  for (const row of report.locales) {
    out.log(
      `${row.locale.padEnd(width)}  ${coverage(row).padEnd(16)} ${bar(row.percent)}  ${row.language}`,
    );
  }
  out.log(
    `\n${String(report.locales.length)} locales, ${String(report.total)} messages in ${report.defaultLocale}`,
  );
  if (report.problems.length > 0) {
    out.error(`\n${String(report.problems.length)} problem(s):`);
    for (const problem of report.problems) out.error(`  - ${problem}`);
  }
}

export function buildReport(root: string, env: NodeJS.ProcessEnv): Report {
  const dir = path.join(root, '_locales');
  const problems: string[] = [];
  const locales = readdirSync(dir)
    .filter((name) => statSync(path.join(dir, name)).isDirectory())
    .sort((a, b) =>
      a === DEFAULT_LOCALE ? -1 : b === DEFAULT_LOCALE ? 1 : a.localeCompare(b),
    );
  const reference = readBundle(dir, DEFAULT_LOCALE, problems);
  checkDefault(reference, problems);
  const referenceBases = new Set(Object.keys(reference).map(baseOf));
  const rows = locales.map((locale) =>
    analyseLocale(dir, locale, reference, referenceBases, problems),
  );
  return {
    defaultLocale: DEFAULT_LOCALE,
    total: referenceBases.size,
    locales: rows,
    problems,
    build: buildMeta(env),
  };
}

// ? reads <root>/_locales, writes <root>/tmp/i18n-report.{md,json} and returns the exit code
export function run(
  root: string,
  env: NodeJS.ProcessEnv = process.env,
  out: Output = console,
): number {
  const dir = path.join(root, '_locales');
  if (!existsSync(path.join(dir, DEFAULT_LOCALE, 'messages.json'))) {
    out.error(`_locales/${DEFAULT_LOCALE}/messages.json is missing in ${root}`);
    return 1;
  }
  const report = buildReport(root, env);
  const reportDir = path.join(root, 'tmp');
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    path.join(reportDir, 'i18n-report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  writeFileSync(path.join(reportDir, 'i18n-report.md'), markdown(report));
  print(report, out);
  return report.problems.length > 0 ? 1 : 0;
}
