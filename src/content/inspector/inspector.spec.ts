import { DEFAULT_SETTINGS } from '@/shared/consts';
import { HOST_TAG } from '@/shared/util';
import { Inspector } from './inspector';

function key(
  type: 'keydown' | 'keyup',
  init: KeyboardEventInit,
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

function typeInto(field: Element, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  field.dispatchEvent(event);
  return event;
}

function touch(type: 'touchstart' | 'touchmove', x: number, y: number): Event {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  Object.defineProperty(event, 'touches', {
    value: { item: () => ({ clientX: x, clientY: y }) },
  });
  document.body.dispatchEvent(event);
  return event;
}

function mouse(
  type: string,
  init: MouseEventInit = {},
  target: EventTarget = document.body,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function host(): HTMLElement | null {
  return document.querySelector(HOST_TAG);
}

function flush(): void {
  jest.advanceTimersByTime(20);
}

// ? copyText awaits the clipboard before the toast shows, so one microtask is not enough
async function settled(): Promise<void> {
  for (let tick = 0; tick < 4; tick += 1) await Promise.resolve();
}

describe('inspector', () => {
  let inspector: Inspector;
  let button: HTMLButtonElement;
  let writeText: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    window.requestAnimationFrame = (cb) =>
      setTimeout(() => cb(0), 16) as unknown as number;
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    document.body.innerHTML = '<main><button id="go">Go</button></main>';
    button = document.getElementById('go') as HTMLButtonElement;
    document.elementFromPoint = jest.fn(() => button);
    writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    inspector = new Inspector();
    inspector.attach();
    inspector.setSettings({ ...DEFAULT_SETTINGS });
  });

  afterEach(() => {
    inspector.detach();
    expect(host()).toBeNull();
    jest.useRealTimers();
  });

  function hold(): void {
    mouse('mousemove', { clientX: 10, clientY: 10 });
    key('keydown', { key: 'Alt' });
    flush();
  }

  // ? rebuilds the inspector with an open shadow root so tests can look inside
  function reopen(): void {
    inspector.detach();
    const attach = Element.prototype.attachShadow;
    jest.spyOn(Element.prototype, 'attachShadow').mockImplementation(function (
      this: Element,
      init,
    ) {
      return attach.call(this, { ...init, mode: 'open' });
    });
    inspector = new Inspector();
    inspector.attach();
    inspector.setSettings({ ...DEFAULT_SETTINGS });
    jest.restoreAllMocks();
  }

  it('does nothing until the modifier is held', () => {
    mouse('mousemove', { clientX: 10, clientY: 10 });
    flush();
    expect(host()).toBeNull();
  });

  it('mounts the host and inspects the element under the pointer while holding', () => {
    hold();
    expect(host()).not.toBeNull();
    expect(document.elementFromPoint).toHaveBeenCalledWith(10, 10);

    const up = key('keyup', { key: 'Alt' });
    expect(up.defaultPrevented).toBe(true);
    key('keyup', { key: 'Alt' });
  });

  it('swallows clicks while holding and toggles the pin', () => {
    hold();
    const down = mouse('mousedown', { altKey: true });
    const click = mouse('click', { altKey: true });
    expect(down.defaultPrevented).toBe(true);
    expect(click.defaultPrevented).toBe(true);

    key('keyup', { key: 'Alt' });
    flush();
    expect(host()).not.toBeNull();

    const plain = mouse('mousedown', {});
    expect(plain.defaultPrevented).toBe(false);
    mouse('click', {});
    flush();
    expect(document.elementFromPoint).toHaveBeenCalled();
  });

  it('unpins with a second modifier click and closes on escape', () => {
    hold();
    mouse('click', { altKey: true });
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });
    hold();
    const esc = key('keydown', { code: 'Escape', key: 'Escape' });
    expect(esc.defaultPrevented).toBe(true);
    key('keydown', { code: 'Escape', key: 'Escape' });
  });

  it('reports a failed screenshot copy when downloads are off', async () => {
    reopen();
    inspector.setSettings({ ...DEFAULT_SETTINGS, downloadScreenshot: false });
    hold();
    (chrome.runtime.sendMessage as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve(null),
    );
    button.getBoundingClientRect = () =>
      ({ x: 10, y: 10, width: 50, height: 20 }) as DOMRect;
    key('keydown', { code: 'KeyC', key: 'c', altKey: true });
    flush();
    flush();
    await settled();
    await settled();
    expect(host()!.shadowRoot!.querySelector('.toast')!.textContent).toBe(
      'Could not copy screenshot',
    );
  });

  it('hides itself for the C screenshot and reports a failed capture', async () => {
    reopen();
    hold();
    const sendMessage = chrome.runtime.sendMessage as jest.Mock;
    sendMessage.mockImplementationOnce(() => Promise.resolve(null));
    button.getBoundingClientRect = () =>
      ({ x: 10, y: 10, width: 50, height: 20 }) as DOMRect;
    const event = key('keydown', { code: 'KeyC', key: 'c', altKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(host()!.hidden).toBe(true);
    flush();
    flush();
    await settled();
    await settled();
    expect(sendMessage).toHaveBeenCalled();
    expect(host()!.hidden).toBe(false);
    expect(host()!.shadowRoot!.querySelector('.toast')!.textContent).toBe(
      'Could not download screenshot',
    );
  });

  it('copies with letter keys and shows a toast', async () => {
    reopen();
    hold();
    const event = key('keydown', { code: 'KeyS', key: 's', altKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith('#go');
    await settled();
    const toast = host()!.shadowRoot!.querySelector('.toast')!;
    expect(toast.textContent).toBe('Copied selector#go');
    expect(toast.classList).toContain('show');
    key('keydown', { code: 'KeyH', key: 'h', altKey: true });
    expect(writeText).toHaveBeenLastCalledWith('<button id="go">Go</button>');
    key('keydown', { code: 'KeyS', key: 's', ctrlKey: true });
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('opens the source in the editor with O when a dev server is present', async () => {
    const fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });
    hold();
    const event = key('keydown', { code: 'KeyO', key: 'o', altKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    const stamped = document.createElement('a');
    stamped.setAttribute('data-qwik-inspector', 'src/routes/index.tsx:3:1');
    document.body.append(stamped);
    (document.elementFromPoint as jest.Mock).mockReturnValue(stamped);
    document.head.innerHTML =
      '<script type="module" src="/@vite/client"></script>';
    mouse('mousemove', { clientX: 12, clientY: 12 });
    flush();
    key('keydown', { code: 'KeyO', key: 'o', altKey: true });
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledWith(
      '/__open-in-editor?file=src%2Froutes%2Findex.tsx%3A3%3A1',
    );
    document.head.innerHTML = '';
  });

  it('compares the hovered element against the one marked with D', () => {
    document.body.innerHTML =
      '<main><p class="a" style="display: block">A</p><p class="b" style="display: flex">B</p></main>';
    const a = document.querySelector('.a')!;
    const b = document.querySelector('.b')!;
    document.elementFromPoint = jest.fn(() => a);
    reopen();
    hold();
    const shadow = host()!.shadowRoot!;
    const compare = () =>
      Array.from(shadow.querySelectorAll('.section-title')).find((title) =>
        title.textContent.startsWith('Compare'),
      );
    const event = key('keydown', { code: 'KeyD', key: 'd', altKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(shadow.querySelector('.toast')?.textContent).toBe(
      'Comparing againstp.a',
    );
    expect(compare()).toBeUndefined();

    document.elementFromPoint = jest.fn(() => b);
    mouse('mousemove', { clientX: 20, clientY: 20 });
    flush();
    expect(compare()?.textContent).toBe('Comparevs p.a');
    expect(shadow.querySelector('.overlay-base')?.hasAttribute('hidden')).toBe(
      false,
    );

    document.elementFromPoint = jest.fn(() => a);
    mouse('mousemove', { clientX: 10, clientY: 10 });
    flush();
    key('keydown', { code: 'KeyD', key: 'd', altKey: true });
    expect(shadow.querySelector('.toast')?.textContent).toBe(
      'Comparison cleared',
    );
    document.elementFromPoint = jest.fn(() => b);
    mouse('mousemove', { clientX: 20, clientY: 20 });
    flush();
    expect(compare()).toBeUndefined();
  });

  it('unpins after marking a pinned element so the next one can be picked', () => {
    reopen();
    hold();
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });
    expect(host()!.shadowRoot!.querySelector('.panel.pinned')).not.toBeNull();
    key('keydown', { code: 'KeyD', key: 'd' });
    expect(
      host()!.shadowRoot!.querySelector('.panel')?.hasAttribute('hidden'),
    ).toBe(true);
    hold();
    key('keydown', { code: 'Escape', key: 'Escape' });
    hold();
    const titles = Array.from(
      host()!.shadowRoot!.querySelectorAll('.section-title'),
      (title) => title.textContent,
    );
    expect(titles.some((title) => title.startsWith('Compare'))).toBe(false);
  });

  it('jumps to an ancestor from the breadcrumbs and walks back down', () => {
    document.body.innerHTML =
      '<section><div class="b"><span class="c">C</span></div></section>';
    const c = document.querySelector('.c')!;
    document.elementFromPoint = jest.fn(() => c);
    reopen();
    hold();
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });
    const shadow = host()!.shadowRoot!;
    const summary = () => shadow.querySelector('.head .summary')?.textContent;
    const crumb = Array.from(
      shadow.querySelectorAll<HTMLElement>('.crumb'),
    ).find((node) => node.textContent === 'section')!;
    crumb.click();
    expect(summary()).toBe('section');
    key('keydown', { code: 'ArrowDown', key: 'ArrowDown' });
    expect(summary()).toBe('div.b');
    key('keydown', { code: 'ArrowDown', key: 'ArrowDown' });
    expect(summary()).toBe('span.c');
  });

  it('navigates to the parent and child and pins while doing so', () => {
    hold();
    key('keydown', { code: 'ArrowUp', key: 'ArrowUp' });
    key('keydown', { code: 'ArrowDown', key: 'ArrowDown' });
    key('keyup', { key: 'Alt' });
    expect(host()).not.toBeNull();
    key('keydown', { code: 'KeyT', key: 't' });
    expect(writeText).toHaveBeenLastCalledWith('Go');
  });

  it('walks back down the path it came up and forgets it on the next pin', () => {
    document.body.innerHTML =
      '<div class="a"><div class="b"><div class="c">C</div></div><div class="d">D</div></div>';
    const a = document.querySelector('.a')!;
    const d = document.querySelector('.d')!;
    const up = () => key('keydown', { code: 'ArrowUp', key: 'ArrowUp' });
    const down = () => key('keydown', { code: 'ArrowDown', key: 'ArrowDown' });
    const text = () => {
      key('keydown', { code: 'KeyT', key: 't' });
      return writeText.mock.lastCall?.[0] as string;
    };

    document.elementFromPoint = jest.fn(() => d);
    hold();
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });
    up();
    expect(text()).toBe('CD');
    up();
    down();
    down();
    expect(text()).toBe('D');
    down();
    expect(text()).toBe('D');
    up();
    expect(text()).toBe('CD');

    document.elementFromPoint = jest.fn(() => a);
    hold();
    mouse('click', { altKey: true });
    flush();
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });
    down();
    expect(text()).toBe('C');
  });

  it('steps between siblings with left and right and keeps the trail', () => {
    document.body.innerHTML =
      '<div class="a"><div class="b"><i>B</i><div class="c">C</div></div><div class="d">D</div></div>';
    const c = document.querySelector('.c')!;
    const press = (code: string) => key('keydown', { code, key: code });
    const text = () => {
      key('keydown', { code: 'KeyT', key: 't' });
      return writeText.mock.lastCall?.[0] as string;
    };

    // ? only a pinned panel walks sideways, so holding Alt alone leaves Alt+Left to the browser
    document.elementFromPoint = jest.fn(() => c);
    hold();
    expect(press('ArrowLeft').defaultPrevented).toBe(false);
    expect(text()).toBe('C');
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });
    expect(press('ArrowLeft').defaultPrevented).toBe(true);
    expect(text()).toBe('B');
    press('ArrowLeft');
    expect(text()).toBe('B');
    press('ArrowRight');
    expect(text()).toBe('C');
    press('ArrowRight');
    expect(text()).toBe('C');

    // ? b's first child is <i>, so landing back on c proves the trail survived the sideways steps
    press('ArrowUp');
    expect(text()).toBe('BC');
    press('ArrowRight');
    expect(text()).toBe('D');
    press('ArrowLeft');
    expect(text()).toBe('BC');
    press('ArrowDown');
    expect(text()).toBe('C');
  });

  it('only moves the highlight on scroll and re-inspects on resize', () => {
    reopen();
    hold();
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });
    const shadow = host()!.shadowRoot!;
    const overlay = shadow.querySelector<HTMLElement>('.overlay')!;
    const summary = () => shadow.querySelector('.head .summary')?.textContent;
    expect(summary()).toBe('button#go');

    button.id = 'moved';
    button.getBoundingClientRect = () =>
      ({ left: 0, top: 40, width: 10, height: 10 }) as DOMRect;
    window.dispatchEvent(new Event('scroll'));
    flush();
    expect(overlay.style.transform).toBe('translate(0px, 40px)');
    expect(summary()).toBe('button#go');

    window.dispatchEvent(new Event('resize'));
    flush();
    expect(summary()).toBe('button#moved');
  });

  it('moves on scroll, hides on blur and when disabled', () => {
    hold();
    window.dispatchEvent(new Event('scroll'));
    flush();
    window.dispatchEvent(new Event('blur'));
    hold();
    inspector.setSettings({ ...DEFAULT_SETTINGS, enabled: false });
    key('keydown', { key: 'Alt' });
    flush();
    expect(
      (document.elementFromPoint as jest.Mock).mock.calls.length,
    ).toBeGreaterThan(0);
  });

  it('ignores its own nodes and detached targets', () => {
    hold();
    const own = host()!;
    (document.elementFromPoint as jest.Mock).mockReturnValue(own);
    mouse('mousemove', { clientX: 11, clientY: 11 });
    flush();
    mouse('click', { altKey: true }, own);
    button.remove();
    window.dispatchEvent(new Event('resize'));
    flush();
    (document.elementFromPoint as jest.Mock).mockReturnValue(null);
    mouse('mousemove', { clientX: 12, clientY: 12 });
    flush();
  });

  it('edits the pinned element, pauses shortcuts while typing and resets', () => {
    reopen();
    hold();
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });
    const shadow = host()!.shadowRoot!;
    const row = Array.from(shadow.querySelectorAll('.row')).find(
      (el) => el.querySelector('.key')?.textContent === 'display',
    )!;
    row.querySelector<HTMLElement>('.editable')!.click();
    const field = shadow.querySelector<HTMLInputElement>('input.edit')!;

    const copy = key('keydown', { code: 'KeyS', key: 's' });
    const esc = key('keydown', { code: 'Escape', key: 'Escape' });
    expect(copy.defaultPrevented).toBe(false);
    expect(esc.defaultPrevented).toBe(false);
    expect(writeText).not.toHaveBeenCalled();

    field.value = 'flex';
    field.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    expect(button.style.display).toBe('flex');
    expect(shadow.querySelector('input.edit')).toBeNull();

    shadow.querySelector<HTMLElement>('[data-action="revert"]')!.click();
    expect(button.getAttribute('style')).toBeNull();
    expect(shadow.querySelector('[data-action="revert"]')).toBeNull();
    expect(shadow.querySelector('.toast')?.textContent).toContain(
      'Edits reset',
    );
  });

  it('respects a different modifier', () => {
    inspector.setSettings({ ...DEFAULT_SETTINGS, modifier: 'Control' });
    key('keydown', { key: 'Alt' });
    flush();
    expect(host()).toBeNull();
    key('keydown', { key: 'Control' });
    flush();
    expect(host()).not.toBeNull();
    const click = mouse('click', { ctrlKey: true });
    expect(click.defaultPrevented).toBe(true);
  });

  it('copies with letter keys while holding Ctrl or Cmd', () => {
    inspector.setSettings({ ...DEFAULT_SETTINGS, modifier: 'Control' });
    mouse('mousemove', { clientX: 10, clientY: 10 });
    key('keydown', { key: 'Control', ctrlKey: true });
    flush();
    const ctrl = key('keydown', { code: 'KeyS', key: 's', ctrlKey: true });
    expect(ctrl.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith('#go');
    const cmd = key('keydown', {
      code: 'KeyS',
      key: 's',
      ctrlKey: true,
      metaKey: true,
    });
    expect(cmd.defaultPrevented).toBe(false);
    key('keyup', { key: 'Control' });

    inspector.setSettings({ ...DEFAULT_SETTINGS, modifier: 'Meta' });
    key('keydown', { key: 'Meta', metaKey: true });
    flush();
    const meta = key('keydown', { code: 'KeyX', key: 'x', metaKey: true });
    expect(meta.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenLastCalledWith('//*[@id="go"]');
  });

  it('never inspects from a text field when the hold key is Shift', () => {
    inspector.setSettings({ ...DEFAULT_SETTINGS, modifier: 'Shift' });
    const field = document.createElement('input');
    document.body.append(field);
    mouse('mousemove', { clientX: 10, clientY: 10 });
    typeInto(field, { key: 'Shift', shiftKey: true });
    flush();
    expect(host()).toBeNull();

    key('keydown', { key: 'Shift', shiftKey: true });
    flush();
    expect(host()).not.toBeNull();
    const letter = typeInto(field, { code: 'KeyH', key: 'H', shiftKey: true });
    expect(letter.defaultPrevented).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });

  it('follows a finger while the key is held and pins with a plain tap', () => {
    reopen();
    const link = document.createElement('a');
    link.href = '#';
    document.body.append(link);
    (document.elementFromPoint as jest.Mock).mockImplementation((x: number) =>
      x > 50 ? link : button,
    );
    expect(touch('touchmove', 10, 10).defaultPrevented).toBe(false);
    expect(host()).toBeNull();

    key('keydown', { key: 'Alt' });
    const shadow = host()!.shadowRoot!;
    const summary = () => shadow.querySelector('.head .summary')?.textContent;
    touch('touchstart', 10, 10);
    flush();
    expect(summary()).toBe('button#go');
    expect(touch('touchmove', 60, 10).defaultPrevented).toBe(true);
    flush();
    expect(summary()).toBe('a');

    const tap = mouse('click', {}, link);
    expect(tap.defaultPrevented).toBe(true);
    expect(shadow.querySelector('.panel')!.classList).toContain('pinned');
    expect(touch('touchmove', 10, 10).defaultPrevented).toBe(false);
    key('keyup', { key: 'Alt' });
    expect(touch('touchmove', 10, 10).defaultPrevented).toBe(false);
    expect(summary()).toBe('a');
  });

  it('pins the tapped element even before the next frame inspects it', () => {
    reopen();
    const link = document.createElement('a');
    link.href = '#';
    document.body.append(link);
    (document.elementFromPoint as jest.Mock).mockImplementation((x: number) =>
      x > 50 ? link : button,
    );
    hold();
    const shadow = host()!.shadowRoot!;
    const summary = () => shadow.querySelector('.head .summary')?.textContent;
    expect(summary()).toBe('button#go');

    touch('touchstart', 60, 10);
    mouse('click', { clientX: 60, clientY: 10, detail: 1 }, link);
    expect(shadow.querySelector('.panel')!.classList).toContain('pinned');
    expect(summary()).toBe('a');

    mouse('click', { altKey: true }, link);
    expect(shadow.querySelector('.panel')!.classList).not.toContain('pinned');
    mouse('click', { altKey: true, clientX: 60, clientY: 10 }, link);
    expect(summary()).toBe('a');
  });

  it('lets plain keys reach a text field while the panel is pinned', () => {
    const field = document.createElement('textarea');
    document.body.append(field);
    hold();
    mouse('click', { altKey: true });
    key('keyup', { key: 'Alt' });

    const plain = typeInto(field, { code: 'KeyS', key: 's' });
    expect(plain.defaultPrevented).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
    const held = typeInto(field, { code: 'KeyS', key: 'ß', altKey: true });
    expect(held.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith('#go');
  });
});
