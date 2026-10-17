import { DEFAULT_SETTINGS } from '@/shared/consts';
import { ElementInfo } from '@/shared/types';
import { CopyAction } from '../actions/actions';
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
    source: null,
  },
  source: {
    file: 'src/Save.tsx',
    line: 12,
    column: 3,
    origin: 'react',
    mapped: true,
  },
  devServer: 'vite',
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
  let onOpen: jest.Mock;
  let read: jest.Mock;
  let write: jest.Mock;
  let revert: jest.Mock;
  let panel: Panel;

  beforeEach(() => {
    root = document.createElement('div');
    document.body.append(root);
    onCopy = jest.fn();
    onOpen = jest.fn();
    read = jest.fn(() => 'block');
    write = jest.fn(() => true);
    revert = jest.fn();
    panel = new Panel(root, {
      copy: onCopy,
      open: onOpen,
      read,
      write,
      revert,
    });
  });

  function editableIn(row: string): HTMLElement {
    const match = Array.from(root.querySelectorAll<HTMLElement>('.row')).find(
      (el) => el.querySelector('.key')?.textContent === row,
    );
    return match!.querySelector<HTMLElement>('.editable')!;
  }

  function input(): HTMLInputElement {
    return root.querySelector<HTMLInputElement>('input.edit')!;
  }

  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    input().dispatchEvent(event);
    return event;
  }

  it('edits a value in place only while pinned', () => {
    panel.render(info, DEFAULT_SETTINGS);
    editableIn('display').click();
    expect(root.querySelector('input.edit')).toBeNull();
    expect(root.querySelector('.add')).toBeNull();

    panel.setPinned(true);
    panel.render(info, DEFAULT_SETTINGS);
    expect(root.querySelector('.foot')?.textContent).toContain(
      'click valueedit',
    );
    editableIn('display').click();
    expect(panel.editing).toBe(true);
    expect(read).toHaveBeenCalledWith({ kind: 'style', property: 'display' });
    expect(input().value).toBe('block');

    const outside = jest.fn();
    document.addEventListener('keydown', outside);
    input().value = 'flex';
    press('Enter');
    document.removeEventListener('keydown', outside);
    expect(outside).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith(
      { kind: 'style', property: 'display' },
      'flex',
    );
    expect(panel.editing).toBe(false);
    expect(root.querySelector('input.edit')).toBeNull();
    expect(editableIn('display').textContent).toBe('block');
  });

  it('offers no edits when editing is turned off in settings', () => {
    panel.setPinned(true);
    const settings = { ...DEFAULT_SETTINGS, allowEdit: false };
    panel.render({ ...info, attributes: [], childCount: 0 }, settings, {
      edited: true,
    });
    const node = root.querySelector('.panel')!;
    expect(node.classList.contains('can-edit')).toBe(false);
    editableIn('display').click();
    expect(panel.editing).toBe(false);
    expect(root.querySelector('.add')).toBeNull();
    expect(root.querySelector('[data-action="remove"]')).toBeNull();
    expect(root.textContent).not.toContain('Attributes');
    expect(root.querySelector('.foot')?.textContent).not.toContain(
      'click value',
    );
    expect(root.querySelector('[data-action="revert"]')).not.toBeNull();

    panel.render(info, DEFAULT_SETTINGS);
    expect(node.classList.contains('can-edit')).toBe(true);
    expect(root.querySelector('.foot')?.textContent).toContain('click value');
  });

  it('keeps an invalid value open, cancels on escape and defers renders', () => {
    panel.setPinned(true);
    panel.render(info, DEFAULT_SETTINGS);
    write.mockReturnValue(false);
    editableIn('color').click();
    input().value = 'nope';
    press('Enter');
    expect(panel.editing).toBe(true);
    expect(input().classList.contains('invalid')).toBe(true);
    expect(input().getAttribute('aria-invalid')).toBe('true');
    input().dispatchEvent(new Event('input'));
    expect(input().classList.contains('invalid')).toBe(false);

    panel.render({ ...info, tag: 'section' }, DEFAULT_SETTINGS, {
      keepScroll: true,
    });
    expect(root.querySelector('.summary .tag')?.textContent).toBe('button');
    press('Escape');
    expect(panel.editing).toBe(false);
    expect(root.querySelector('.summary .tag')?.textContent).toBe('section');

    editableIn('display').click();
    input().value = 'grid';
    input().dispatchEvent(new FocusEvent('blur'));
    expect(panel.editing).toBe(false);

    editableIn('display').click();
    write.mockClear();
    press('Enter');
    expect(write).not.toHaveBeenCalled();
    expect(panel.editing).toBe(false);

    editableIn('display').click();
    panel.hide();
    expect(panel.editing).toBe(false);
  });

  it('adds, removes and resets through the pinned panel', () => {
    panel.setPinned(true);
    panel.render({ ...info, childCount: 0, text: '' }, DEFAULT_SETTINGS, {
      edited: true,
    });

    root.querySelector<HTMLElement>('[data-action="revert"]')!.click();
    expect(revert).toHaveBeenCalledTimes(1);

    root.querySelector<HTMLElement>('[data-action="remove"]')!.click();
    expect(write).toHaveBeenCalledWith(
      { kind: 'attribute', name: 'data-0' },
      null,
    );

    const adders = root.querySelectorAll<HTMLElement>('.add');
    expect(Array.from(adders, (a) => a.textContent)).toEqual([
      '+ style',
      '+ attribute',
    ]);
    adders[1]!.click();
    expect(input().placeholder).toBe('name="value"');
    expect(input().value).toBe('');
    input().value = 'data-x="1"';
    press('Enter');
    expect(write).toHaveBeenLastCalledWith(
      { kind: 'new-attribute' },
      'data-x="1"',
    );

    root.querySelector<HTMLElement>('.cell.m .editable')!.click();
    expect(read).toHaveBeenLastCalledWith({
      kind: 'style',
      property: 'margin',
      lengths: true,
    });
    press('Escape');

    editableIn('Text').click();
    expect(read).toHaveBeenLastCalledWith({ kind: 'text' });
    press('Escape');

    editableIn('Size').click();
    expect(read).toHaveBeenLastCalledWith({
      kind: 'style',
      property: 'width',
      lengths: true,
    });
    press('Escape');

    editableIn('Name').click();
    expect(read).toHaveBeenLastCalledWith({
      kind: 'attribute',
      name: 'aria-label',
    });
    press('Escape');

    editableIn('Source').click();
    press('Escape');
    editableIn('Alt').click();
    expect(read).toHaveBeenLastCalledWith({ kind: 'attribute', name: 'alt' });
    press('Escape');

    panel.render(
      {
        ...info,
        attributes: [],
        media: { kind: 'svg', source: '' },
      },
      DEFAULT_SETTINGS,
    );
    editableIn('Source').click();
    expect(read).toHaveBeenLastCalledWith({
      kind: 'attribute',
      name: 'viewBox',
    });
    press('Escape');
    expect(root.textContent).toContain('+ attribute');
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
    expect(text).toContain('Events2 listeners');
    expect(text).toContain('FrameworkReact');
    expect(text).toContain('ComponentSaveButton');
    expect(text).toContain('Sourcesrc/\u200BSave.tsx:12:3react');
    expect(root.querySelector('[data-action="open"]')).not.toBeNull();
    expect(root.querySelector('.foot')?.textContent).toContain('Oopen source');
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
        events: { listeners: [], framework: null, source: null },
        source: null,
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
    root.querySelector<HTMLElement>('[data-action="open"]')!.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
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

  it('sits above or below the pointer when there is no room beside it', () => {
    Object.defineProperty(window, 'innerWidth', {
      value: 500,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
    });
    panel.show();
    const node = root.querySelector<HTMLElement>('.panel')!;
    Object.defineProperty(node, 'offsetWidth', { value: 300 });

    panel.position(250, 300);
    expect(node.style.getPropertyValue('--room')).toBe('474px');
    expect(node.style.left).toBe('100px');
    expect(node.style.top).toBe('318px');

    panel.position(250, 700);
    expect(node.style.getPropertyValue('--room')).toBe('674px');
    expect(node.style.top).toBe('382px');

    panel.position(100, 300);
    expect(node.style.getPropertyValue('--room')).toBe('');
    expect(node.style.left).toBe('118px');
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

    expect(node.style.getPropertyValue('--room')).toBe('');

    panel.setPinned(true);
    panel.render(info, DEFAULT_SETTINGS);
    expect(node.classList.contains('pinned')).toBe(true);
    expect(root.querySelector('.pin')?.textContent).toBe('pinned');
    expect(root.querySelector('.foot')?.textContent).toContain('unpin');
    panel.hide();
    expect(panel.visible).toBe(false);
  });
});
