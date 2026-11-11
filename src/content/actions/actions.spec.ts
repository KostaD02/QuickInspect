import { ElementInfo } from '@/shared/types';
import { actionByCode, COPY_ACTIONS } from './actions';

const info = {
  selector: '#a',
  xpath: '//*[@id="a"]',
  locators: [{ strategy: 'css', code: "page.locator('#a')", matches: 1 }],
  box: { x: 0, y: 0, width: 1, height: 1, margin: {}, padding: {}, border: {} },
  styles: [],
  accessibility: { role: '', name: '', focusable: false, aria: [] },
  attributes: [],
} as unknown as ElementInfo;

describe('actions', () => {
  it('maps key codes to actions', () => {
    expect(actionByCode('KeyS')?.id).toBe('selector');
    expect(actionByCode('KeyQ')).toBeUndefined();
  });

  it('produces the copy payloads', () => {
    const el = document.createElement('div');
    el.id = 'a';
    el.textContent = ' hello ';
    const values = Object.fromEntries(
      COPY_ACTIONS.filter((a) => a.id !== 'json' && a.id !== 'markdown').map(
        (a) => [a.id, a.value(info, el)],
      ),
    );
    expect(values).toEqual({
      selector: '#a',
      xpath: '//*[@id="a"]',
      locator: "page.locator('#a')",
      html: '<div id="a"> hello </div>',
      text: 'hello',
    });
    expect(actionByCode('KeyL')?.value({ ...info, locators: [] }, el)).toBe(
      '#a',
    );
  });

  it('copies the whole element info as JSON and Markdown', () => {
    const el = document.createElement('div');
    expect(JSON.parse(actionByCode('KeyJ')?.value(info, el) ?? '')).toEqual(
      info,
    );
    expect(actionByCode('KeyM')?.value(info, el)).toContain('- Selector: `#a`');
  });
});
