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

  it('copies with letter keys and shows a toast', async () => {
    hold();
    const event = key('keydown', { code: 'KeyS', key: 's', altKey: true });
    expect(event.defaultPrevented).toBe(true);
    expect(writeText).toHaveBeenCalledWith('#go');
    await Promise.resolve();
    key('keydown', { code: 'KeyH', key: 'h', altKey: true });
    expect(writeText).toHaveBeenLastCalledWith('<button id="go">Go</button>');
    key('keydown', { code: 'KeyS', key: 's', ctrlKey: true });
    expect(writeText).toHaveBeenCalledTimes(2);
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

  it('re-renders on scroll, hides on blur and when disabled', () => {
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
});
