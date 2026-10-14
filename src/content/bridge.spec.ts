import { PROBE_EVENT, REPLY_EVENT } from '@/shared/types/events';
import type { EventsInfo } from '@/shared/types/events';
import { collectEvents } from './bridge';

type Bag = Record<string, unknown>;

function button(): HTMLButtonElement {
  const el = document.createElement('button');
  document.body.append(el);
  return el;
}

describe('bridge', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete (window as unknown as Bag).jQuery;
  });

  it('records listeners added through addEventListener with their flags', () => {
    const el = button();
    function handleClick() {}
    el.addEventListener('click', handleClick);
    el.addEventListener('click', handleClick);
    el.addEventListener('keydown', () => {}, {
      passive: true,
      once: true,
      capture: true,
    });
    el.addEventListener('focus', { handleEvent() {} });
    el.addEventListener('blur', null as unknown as EventListener);

    const { listeners } = collectEvents(el);
    expect(listeners.map((l) => [l.type, l.name, l.flags])).toEqual([
      ['click', 'handleClick', []],
      ['keydown', 'anonymous', ['capture', 'once', 'passive']],
      ['focus', 'handleEvent', []],
    ]);
    expect(listeners[0]?.source).toContain('function handleClick');

    el.removeEventListener('click', handleClick);
    el.removeEventListener('click', handleClick);
    expect(collectEvents(el).listeners.map((l) => l.type)).toEqual([
      'keydown',
      'focus',
    ]);
  });

  it('reports inline handlers', () => {
    const el = button();
    el.onclick = function refresh() {};
    el.setAttribute('onmouseenter', 'void 0');
    const types = collectEvents(el).listeners.map(
      (l) => `${l.origin}:${l.type}:${l.name}`,
    );
    expect(types).toContain('inline:click:refresh');
    expect(types).toContain('inline:mouseenter:onmouseenter');
  });

  it('reads React props and finds the owning component', () => {
    const el = button() as unknown as Bag;
    el.__reactProps$x = {
      onClick: function save() {},
      onMouseEnterCapture: () => {},
      children: 'x',
    };
    el.__reactFiber$x = {
      type: 'button',
      return: { type: { render: function Forwarded() {} }, return: null },
    };
    const info = collectEvents(el as unknown as Element);
    expect(info.framework).toEqual({ name: 'React', component: 'Forwarded' });
    expect(
      info.listeners.map((l) => [l.origin, l.type, l.name, l.flags]),
    ).toEqual([
      ['React', 'click', 'save', []],
      ['React', 'mouseenter', 'onMouseEnterCapture', ['capture']],
    ]);
  });

  it('reads Vue invokers and component names', () => {
    const el = button() as unknown as Bag;
    el._vei = {
      onClick: { value: function toggle() {} },
      onInput: { value: [() => {}] },
    };
    el.__vueParentComponent = { type: { __name: 'Toggle' } };
    const info = collectEvents(el as unknown as Element);
    expect(info.framework).toEqual({ name: 'Vue', component: 'Toggle' });
    expect(info.listeners.map((l) => l.type)).toEqual(['click', 'input']);

    const legacy = button() as unknown as Bag;
    legacy.__vue__ = { $options: { name: 'Legacy' } };
    expect(
      collectEvents(legacy as unknown as Element).framework?.component,
    ).toBe('Legacy');
  });

  it('detects Angular, Svelte and jQuery', () => {
    const ng = button() as unknown as Bag;
    ng.__ngContext__ = [];
    (window as unknown as Bag).ng = {
      getComponent: () =>
        new (class Hero {
          id = 1;
        })(),
    };
    expect(collectEvents(ng as unknown as Element).framework).toEqual({
      name: 'Angular',
      component: 'Hero',
    });
    delete (window as unknown as Bag).ng;
    expect(collectEvents(ng as unknown as Element).framework?.component).toBe(
      '',
    );

    const svelte = button() as unknown as Bag;
    svelte.__svelte_meta = { loc: { file: 'src/lib/Card.svelte' } };
    expect(collectEvents(svelte as unknown as Element).framework).toEqual({
      name: 'Svelte',
      component: 'Card.svelte',
    });

    const jq = button();
    (window as unknown as Bag).jQuery = {
      _data: () => ({
        click: [{ handler: function onJq() {}, namespace: 'ns' }],
      }),
    };
    const info = collectEvents(jq);
    expect(info.listeners).toEqual([
      expect.objectContaining({
        origin: 'jQuery',
        type: 'click',
        name: 'onJq',
        flags: ['.ns'],
      }),
    ]);
    expect(info.framework).toBeNull();
  });

  it('answers probes with a JSON reply on the target', () => {
    const el = button();
    el.addEventListener('click', function go() {});
    let reply: EventsInfo | null = null;
    el.addEventListener(REPLY_EVENT, (event) => {
      reply = JSON.parse((event as CustomEvent<string>).detail) as EventsInfo;
    });
    el.dispatchEvent(new CustomEvent(PROBE_EVENT, { composed: true }));
    expect(reply!.listeners.map((l) => l.name)).toEqual(['go']);
    expect(
      document.documentElement.getAttribute('data-quickinspect-reply'),
    ).toContain('go');
    document.documentElement.removeAttribute('data-quickinspect-reply');
  });
});
