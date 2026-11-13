import { uiLanguage } from '../i18n/i18n';

const STAMP_PARTS = new Set(['day', 'month', 'year', 'hour', 'minute']);

// ? the locale decides the order of day, month and year; digits stay Latin so the name is safe on any file system
export function timestamp(date: Date, locale = uiLanguage()): string {
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      numberingSystem: 'latn',
    });
  } catch {
    return timestamp(date, 'en-GB');
  }
  return format
    .formatToParts(date)
    .filter((part) => STAMP_PARTS.has(part.type))
    .map((part) => part.value)
    .join('-');
}

export function fileName(
  summary: string,
  date: Date,
  extension: string,
): string {
  const element =
    summary
      .replace(/[^\w-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'element';
  return `QuickInspect-${element}-${timestamp(date)}.${extension}`;
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
