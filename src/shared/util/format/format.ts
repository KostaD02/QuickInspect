export function px(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toString()}px`;
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function squash(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

const CHANNEL =
  /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/;

export function toHex(color: string): string {
  const match = CHANNEL.exec(color);
  if (!match) return color;

  const [, r, g, b] = match;
  const a = match[4] || '';
  const hex = [r, g, b]
    .map((channel) => Math.round(Number(channel)).toString(16).padStart(2, '0'))
    .join('');

  if (!a) return `#${hex}`;

  const alpha = a.endsWith('%') ? Number(a.slice(0, -1)) / 100 : Number(a);
  if (alpha >= 1) return `#${hex}`;

  return `#${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

export function isTransparent(color: string): boolean {
  if (color === 'transparent') return true;
  const match = CHANNEL.exec(color);
  return match?.[4] !== undefined && Number(match[4]) === 0;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'live';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString()}:${s.toString().padStart(2, '0')}`;
}
