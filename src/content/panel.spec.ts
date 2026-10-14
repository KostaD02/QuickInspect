import { DEFAULT_SETTINGS } from '@/shared/consts';
import { ElementInfo } from '@/shared/types';
import { CopyAction } from './actions';
import { Panel } from './panel';

const info: ElementInfo = {
  tag: 'button',
  id: 'save',
  classes: ['a', 'b', 'c', 'd'],
  summary: 'button#save.a.b.c +1',
  text: 'Save',
  selector: '#save',
  xpath: '//*[@id="save"]',
  locators: [
    { strategy: 'role', code: "page.getByRole('button')", matches: 2 },
    { strategy: 'css', code: "page.locator('#save')", matches: 1 },
  ],
  box: {
    x: 1,
    y: 2,
    width: 30,
    height: 40,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 1, right: 2, bottom: 3, left: 4 },
    border: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  styles: [
    { property: 'display', value: 'block' },
    { property: 'color', value: '#ff0000', color: 'rgb(255, 0, 0)' },
  ],
  accessibility: {
    role: 'button',
    name: 'Save',
    focusable: true,
    tabIndex: 0,
    aria: [{ name: 'aria-pressed', value: 'true' }],
  },
  attributes: Array.from({ length: 14 }, (_, i) => ({
    name: `data-${i.toString()}`,
    value: i % 2 ? 'v' : '',
  })),
  ancestors: [
    { summary: 'form', depth: 1 },
    { summary: 'main', depth: 2 },
  ],
  shadowHost: null,
  childCount: 1,
  events: {
    listeners: [
      {
        type: 'click',
        origin: 'listener',
        name: 'handleSave',
        source: 'function handleSave() {}',
        flags: ['once'],
      },
      {
        type: 'mouseenter',
        origin: 'React',
        name: 'anonymous',
        source: '',
        flags: [],
      },
    ],
    framework: { name: 'React', component: 'SaveButton' },
  },
  media: {
    kind: 'image',
    source: 'a.png',
    naturalWidth: 10,
    naturalHeight: 20,
    duration: 61,
    alt: '',
  },
};

describe('panel', () => {
  let root: HTMLElement;
  let onCopy: jest.Mock;
  let panel: Panel;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
    onCopy = jest.fn();
    panel = new Panel(root, onCopy);
  });

  afterEach(() => {
    root.remove();
  });

  it('renders every section with the right content', () => {
    panel.render(info, DEFAULT_SETTINGS);
    const text = root.textContent;
    expect(root.querySelector('.summary')?.textContent).toBe(
      'button#save.a.b.c +1',
    );
    expect(text).toContain('30 × 40');
    expect(text).toContain("Rolepage.getByRole('button')2 matches");
    expect(text).toContain('Playwright');
    expect(text).toContain('clickhandleSaveoncefunction handleSave() {}');
    expect(text).toContain('mouseenteranonymousReact');
    expect(text).toContain('React · SaveButton');
    expect(root.querySelector('.section-title span')?.textContent).toBe('Box');
    expect(
      root.querySelector('.section:last-child .section-title span')
        ?.textContent,
    ).toBe('Selectors');
    expect(text).toContain("page.locator('#save')unique");
    expect(text).toContain('1 2 3 4');
    expect(root.querySelector('.swatch')).not.toBeNull();
    expect(text).toContain('aria-pressed="true"');
    expect(text).toContain('+2 more');
    expect(text).toContain('main›form›button#save.a.b.c +1');
    expect(text).toContain('1 child');
    expect(text).toContain('1:01');
    expect(text).toContain('empty');
    expect(root.querySelectorAll('[data-action="locator"]')).toHaveLength(1);
  });

  it('hides sections per settings and shows generic fallbacks', () => {
    panel.render(
      {
        ...info,
        media: null,
        events: { listeners: [], framework: null },
        attributes: [],
        accessibility: {
          role: '',
          name: '',
          focusable: false,
          tabIndex: null,
          aria: [],
        },
      },
      {
        ...DEFAULT_SETTINGS,
        showSelectors: false,
        showBox: false,
        showStyles: false,
      },
    );
    const text = root.textContent;
    expect(root.querySelectorAll('.section')).toHaveLength(3);
    expect(text).toContain('no listeners on this element');
    expect(text).toContain('generic');
    expect(text).toContain('none');

    panel.render({ ...info, shadowHost: 'x-widget' }, DEFAULT_SETTINGS);
    expect(root.textContent).toContain('inside shadow root of x-widget');
  });

  it('dispatches copy actions from buttons and flashes them', () => {
    jest.useFakeTimers();
    panel.render(info, DEFAULT_SETTINGS);
    const button = root.querySelector<HTMLElement>('[data-action="xpath"]')!;
    button.click();
    expect(onCopy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'xpath' }),
    );
    panel.flash(onCopy.mock.calls[0][0] as CopyAction);
    expect(button.classList.contains('done')).toBe(true);
    jest.advanceTimersByTime(900);
    expect(button.classList.contains('done')).toBe(false);
    root.querySelector<HTMLElement>('.body')!.click();
    expect(onCopy).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('drags by the head only while pinned and stays inside the viewport', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 600,
      configurable: true,
    });
    panel.render(info, DEFAULT_SETTINGS);
    panel.show();
    const node = root.querySelector<HTMLElement>('.panel')!;
    const head = root.querySelector<HTMLElement>('.head')!;
    node.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
    const pointer = (type: string, x: number, y: number) =>
      head.dispatchEvent(
        new MouseEvent(type, {
          clientX: x,
          clientY: y,
          bubbles: true,
          button: 0,
        }),
      );

    pointer('pointerdown', 120, 60);
    pointer('pointermove', 320, 260);
    expect(node.style.left).toBe('');

    panel.setPinned(true);
    expect(root.querySelector('.foot')?.textContent).toContain('dragmove');
    pointer('pointerdown', 120, 60);
    expect(node.classList.contains('dragging')).toBe(true);
    pointer('pointermove', 320, 260);
    expect(node.style.left).toBe('300px');
    expect(node.style.top).toBe('250px');
    pointer('pointermove', 2000, 2000);
    expect(parseInt(node.style.left)).toBeLessThan(800);
    expect(parseInt(node.style.top)).toBeLessThan(600);
    pointer('pointerup', 2000, 2000);
    expect(node.classList.contains('dragging')).toBe(false);
    pointer('pointermove', 10, 10);
    expect(parseInt(node.style.left)).toBeGreaterThan(100);
  });

  it('positions itself inside the viewport and tracks pinned state', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 800,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 600,
      configurable: true,
    });
    panel.show();
    expect(panel.visible).toBe(true);
    const node = root.querySelector<HTMLElement>('.panel')!;
    panel.position(10, 10);
    expect(node.style.left).toBe('28px');
    panel.position(790, 590);
    expect(parseInt(node.style.left)).toBeLessThan(790);
    expect(parseInt(node.style.top)).toBeLessThan(590);

    panel.setPinned(true);
    panel.render(info, DEFAULT_SETTINGS);
    expect(node.classList.contains('pinned')).toBe(true);
    expect(root.querySelector('.pin')?.textContent).toBe('pinned');
    expect(root.querySelector('.foot')?.textContent).toContain('unpin');
    panel.hide();
    expect(panel.visible).toBe(false);
  });
});
