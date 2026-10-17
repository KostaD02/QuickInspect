import { brandTokens } from './tokens';

describe('brand tokens', () => {
  it('declares the dark theme and the shared tokens on the given selector', () => {
    const css = brandTokens(':host');
    expect(css.startsWith(':host {')).toBe(true);
    expect(css).toContain('color-scheme: dark;');
    expect(css).toContain('--kd-bg: #0a192f;');
    expect(css).toContain('--kd-accent: #64ffda;');
    expect(css).toContain('--kd-code-type: #7fdbca;');
    expect(css).toContain('--kd-radius-md: 8px;');
    expect(css).toContain('--kd-font-mono: "JetBrains Mono"');
    expect(css).not.toContain('--kd-bg: #f5f7fb;');
  });
});
