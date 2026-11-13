import { ElementInfo } from '@/shared/types';
import { toJson, toMarkdown } from './snapshot';

const edges = { top: 1, right: 2, bottom: 3, left: 4 };
const info = {
  summary: 'button#go.primary',
  selector: '#go',
  xpath: '//*[@id="go"]',
  text: 'Go',
  locators: [
    { strategy: 'role', code: "page.getByRole('button')", matches: 1 },
  ],
  box: {
    x: 10.4,
    y: 20.6,
    width: 100,
    height: 30,
    margin: edges,
    padding: edges,
    border: edges,
    gap: null,
    gaps: [],
  },
  styles: [{ property: 'display', value: 'flex' }],
  accessibility: {
    role: 'button',
    name: 'Go',
    focusable: true,
    tabIndex: 0,
    aria: [{ name: 'aria-pressed', value: 'false' }],
  },
  attributes: [{ name: 'id', value: 'go' }],
} as unknown as ElementInfo;

describe('snapshot', () => {
  it('serialises the info as JSON', () => {
    expect(JSON.parse(toJson(info))).toEqual(info);
  });

  it('writes a Markdown summary', () => {
    expect(toMarkdown(info)).toBe(
      [
        '## button#go.primary',
        '',
        '- Selector: `#go`',
        '- XPath: `//*[@id="go"]`',
        "- Locator: `page.getByRole('button')`",
        '',
        '### Box',
        '- Position: 10.4, 20.6',
        '- Size: 100 × 30',
        '- Margin: 1 2 3 4',
        '- Padding: 1 2 3 4',
        '- Border: 1 2 3 4',
        '',
        '### Styles',
        '- display: `flex`',
        '',
        '### Accessibility',
        '- Role: button',
        '- Name: `Go`',
        '- Focusable: yes',
        '- aria-pressed: `false`',
        '',
        '### Attributes',
        '- id: `go`',
        '',
        '### Text',
        'Go',
      ].join('\n'),
    );
  });

  it('leaves out empty sections and escapes backticks', () => {
    const bare = {
      ...info,
      text: '',
      locators: [],
      styles: [],
      attributes: [],
      accessibility: { role: '', name: 'a`b', focusable: false, aria: [] },
    } as unknown as ElementInfo;
    const markdown = toMarkdown(bare);
    expect(markdown).not.toContain('Locator');
    expect(markdown).not.toContain('### Styles');
    expect(markdown).not.toContain('### Attributes');
    expect(markdown).not.toContain('### Text');
    expect(markdown).toContain('- Role: none');
    expect(markdown).toContain('- Name: `a\\`b`');
    expect(markdown).toContain('- Focusable: no');
  });
});
