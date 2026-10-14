import {
  formatDuration,
  isTransparent,
  px,
  round,
  squash,
  toHex,
  truncate,
} from './format';

describe('format', () => {
  it('formats pixels with two decimals max', () => {
    expect(px(10)).toBe('10px');
    expect(px(10.456)).toBe('10.46px');
    expect(round(1.005)).toBe(1);
  });

  it('truncates long strings with an ellipsis', () => {
    expect(truncate('short', 10)).toBe('short');
    expect(truncate('a very long value', 8)).toBe('a very…');
  });

  it('squashes whitespace', () => {
    expect(squash('  a \n b\t c ')).toBe('a b c');
  });

  it('converts rgb colors to hex', () => {
    expect(toHex('rgb(100, 255, 218)')).toBe('#64ffda');
    expect(toHex('rgba(10, 25, 47, 0.5)')).toBe('#0a192f80');
    expect(toHex('rgba(10, 25, 47, 1)')).toBe('#0a192f');
    expect(toHex('rgb(10 25 47 / 50%)')).toBe('#0a192f80');
    expect(toHex('red')).toBe('red');
  });

  it('detects transparent colors', () => {
    expect(isTransparent('transparent')).toBe(true);
    expect(isTransparent('rgba(0, 0, 0, 0)')).toBe(true);
    expect(isTransparent('rgb(0, 0, 0)')).toBe(false);
  });

  it('formats durations', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(Infinity)).toBe('live');
  });
});
