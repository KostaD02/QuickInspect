import { PROBE_EVENT, REPLY_EVENT } from '@/shared/types/events';
import type { EventsInfo } from '@/shared/types/events';
import { collectEvents, collectSource } from './bridge';

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

  it('forgets once and aborted listeners when the browser drops them', () => {
    const el = button();
    const names = () => collectEvents(el).listeners.map((l) => l.name);
    const controller = new AbortController();
    el.addEventListener('click', function fired() {}, { once: true });
    el.addEventListener('click', function aborted() {}, {
      signal: controller.signal,
    });
    el.addEventListener('click', function never() {}, {
      signal: AbortSignal.abort(),
    });
    el.addEventListener('click', function stays() {});
    expect(names()).toEqual(['fired', 'aborted', 'stays']);

    el.click();
    controller.abort();
    expect(names()).toEqual(['stays']);
  });

  it('keeps a once listener that did not run', () => {
    const el = button();
    const names = () => collectEvents(el).listeners.map((l) => l.name);
    el.addEventListener('click', function stop(event) {
      event.stopImmediatePropagation();
    });
    el.addEventListener('click', function later() {}, { once: true });
    el.click();
    expect(names()).toEqual(['stop', 'later']);
  });

  it('stops watching a once listener the page removed itself', () => {
    const el = button();
    function toggle() {}
    el.addEventListener('click', toggle, { once: true });
    el.removeEventListener('click', toggle);
    el.addEventListener('click', toggle);
    el.click();
    expect(collectEvents(el).listeners.map((l) => l.name)).toEqual(['toggle']);
  });

  it('accepts null options like the native call', () => {
    const el = button();
    const options = null as unknown as boolean;
    expect(() => {
      el.addEventListener('click', function go() {}, options);
    }).not.toThrow();
    expect(collectEvents(el).listeners.map((l) => l.name)).toEqual(['go']);
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

  it('drops minified React component names and prefers displayName', () => {
    const el = button() as unknown as Bag;
    el.__reactFiber$x = {
      type: 'button',
      return: { type: function li() {}, return: { type: 'nav', return: null } },
    };
    expect(collectEvents(el as unknown as Element).framework).toEqual({
      name: 'React',
      component: '',
    });

    const named = function t() {};
    (named as unknown as Bag).displayName = 'NavItem';
    el.__reactFiber$x = {
      type: 'button',
      return: { type: { render: named }, return: null },
    };
    expect(collectEvents(el as unknown as Element).framework?.component).toBe(
      'NavItem',
    );
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

  it('detects Angular anywhere under its root and names the owning component', () => {
    document.body.innerHTML =
      '<app-root ng-version="18.0.0"><main><p id="deep">x</p></main></app-root>';
    const deep = document.getElementById('deep')!;
    (window as unknown as Bag).ng = {
      getComponent: () => null,
      getOwningComponent: () =>
        new (class HomeComponent {
          id = 1;
        })(),
    };
    expect(collectEvents(deep).framework).toEqual({
      name: 'Angular',
      component: 'HomeComponent',
    });
    delete (window as unknown as Bag).ng;
    expect(collectEvents(deep).framework).toEqual({
      name: 'Angular',
      component: '',
    });
    document.body.innerHTML = '';
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
    svelte.__svelte_meta = {
      loc: { file: 'src/lib/Card.svelte', line: 11, column: 1 },
    };
    expect(collectSource(svelte as unknown as Element)).toEqual({
      file: 'src/lib/Card.svelte',
      line: 11,
      column: 2,
      origin: 'svelte',
      mapped: true,
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

  it('reads the owner stack past React and its bundled jsx runtime', () => {
    const chunk =
      'http://localhost:3000/_next/static/chunks/_1gde2ywkv7hqq._.js';
    const client = button() as unknown as Bag;
    client.__reactFiber$x = {
      _debugStack: {
        stack: [
          'Error: react-stack-top-frame',
          `    at exports.jsxDEV (${chunk}:255:33)`,
          `    at Probe (${chunk}:20:332)`,
          '    at Object.react_stack_bottom_frame (http://localhost:3000/_next/static/chunks/1usf_next_dist_compiled_react-dom_cjs_react-dom-client_development_1pccmj08y8vlp.js:15013:24)',
        ].join('\n'),
      },
    };
    expect(collectSource(client as unknown as Element)).toEqual({
      file: '_next/static/chunks/_1gde2ywkv7hqq._.js',
      line: 20,
      column: 332,
      origin: 'react',
      mapped: false,
    });

    const server = button() as unknown as Bag;
    server.__reactFiber$x = {
      _debugStack: {
        stack: [
          'Error: react-stack-top-frame',
          '    at fakeJSXCallSite (http://localhost:3000/_next/static/chunks/1usf_next_dist_compiled_react-server-dom-turbopack_18ks1ugxz5r6v._.js:2093:21)',
          '    at Home (about://React/Prerender/C:%5Capp%5C.next%5Cdev%5Cserver%5Cchunks%5Cssr%5C%5Broot-of-the-server%5D__1w9._.js?3:32:375)',
        ].join('\n'),
      },
    };
    expect(collectSource(server as unknown as Element)).toMatchObject({
      file: 'C:\\app\\.next\\dev\\server\\chunks\\ssr\\[root-of-the-server]__1w9._.js',
      line: 32,
      column: 375,
    });
  });

  it('reads Vue template positions from the Nuxt DevTools tracer', () => {
    const app = {
      type: { __file: 'C:/proj/app/app.vue' },
      vnode: { props: {} },
    };
    const link = {
      type: { name: 'NuxtLink' },
      parent: app,
      vnode: { props: {} },
    };
    const routerLink = {
      type: { name: 'RouterLink' },
      parent: link,
      vnode: {},
    };
    const probe = {
      type: { __file: 'C:/proj/app/components/Probe.vue' },
      parent: app,
      vnode: { props: {} },
    };
    const vnodeToPos = new WeakMap<object, unknown>([
      [
        app.vnode.props,
        ['node_modules/nuxt/dist/app/components/nuxt-root.vue', 16, 4],
      ],
      [link.vnode.props, ['app/app.vue', 6, 6]],
      [probe.vnode.props, ['app/app.vue', 13, 4]],
    ]);
    (globalThis as unknown as Bag).__vue_tracer__ = { vnodeToPos };

    // ? slot content written in app.vue but mounted by Probe
    const slotted = button() as unknown as Bag;
    slotted.__vueParentComponent = probe;
    slotted.__vnode = { props: {} };
    vnodeToPos.set((slotted.__vnode as Bag).props as object, [
      'app/app.vue',
      14,
      6,
    ]);
    expect(collectSource(slotted as unknown as Element)).toEqual({
      file: 'C:/proj/app/app.vue',
      line: 14,
      column: 7,
      origin: 'vue',
      mapped: true,
    });

    // ? RouterLink's own <a> has no position, so the NuxtLink usage answers, not the <nav> around it
    const nav = document.createElement('nav') as unknown as Bag;
    nav.__vueParentComponent = app;
    nav.__vnode = { props: {} };
    vnodeToPos.set((nav.__vnode as Bag).props as object, ['app/app.vue', 5, 4]);
    document.body.append(nav as unknown as Element);
    const anchor = document.createElement('a') as unknown as Bag;
    anchor.__vueParentComponent = routerLink;
    anchor.__vnode = { props: { href: '/' } };
    (nav as unknown as Element).append(anchor as unknown as Element);
    expect(collectSource(anchor as unknown as Element)).toMatchObject({
      file: 'C:/proj/app/app.vue',
      line: 6,
      column: 7,
    });

    // ? stringified static content has no vnode, so its container answers
    const container = button() as unknown as Bag;
    container.__vueParentComponent = probe;
    container.__vnode = { props: {} };
    vnodeToPos.set((container.__vnode as Bag).props as object, [
      'app/components/Probe.vue',
      6,
      2,
    ]);
    const inner = document.createElement('li');
    (container as unknown as Element).append(inner);
    expect(collectSource(inner)).toMatchObject({
      file: 'C:/proj/app/components/Probe.vue',
      line: 6,
      column: 3,
    });

    // ? a relative path stays relative when no component up the chain has it
    const orphan = button() as unknown as Bag;
    orphan.__vueParentComponent = { type: {}, vnode: {} };
    orphan.__vnode = { props: {} };
    vnodeToPos.set((orphan.__vnode as Bag).props as object, [
      'src/Other.vue',
      2,
      0,
    ]);
    expect(collectSource(orphan as unknown as Element)?.file).toBe(
      'src/Other.vue',
    );

    delete (globalThis as unknown as Bag).__vue_tracer__;
  });

  it('climbs to the nearest Vue SFC with a __file when the owner is a plain component', () => {
    const page = { type: { __file: '/proj/app/pages/index.vue' } };
    const ui = {
      type: { __file: '/proj/node_modules/ui/Button.vue' },
      parent: page,
    };
    const clientOnly = { type: { name: 'ClientOnly' }, parent: page };
    const inside = button() as unknown as Bag;
    inside.__vueParentComponent = clientOnly;
    expect(collectSource(inside as unknown as Element)).toEqual({
      file: '/proj/app/pages/index.vue',
      line: null,
      column: null,
      origin: 'vue',
      mapped: true,
    });
    const library = button() as unknown as Bag;
    library.__vueParentComponent = ui;
    expect(collectSource(library as unknown as Element)?.file).toBe(
      '/proj/app/pages/index.vue',
    );
    const only = button() as unknown as Bag;
    only.__vueParentComponent = {
      type: { __file: '/proj/node_modules/ui/Button.vue' },
    };
    expect(collectSource(only as unknown as Element)?.file).toBe(
      '/proj/node_modules/ui/Button.vue',
    );
  });

  it('installs only once when the bridge is injected again', async () => {
    const add = EventTarget.prototype.addEventListener;
    await jest.isolateModulesAsync(async () => {
      await import('./bridge');
    });
    expect(EventTarget.prototype.addEventListener).toBe(add);
    const el = button();
    const replies = jest.fn();
    el.addEventListener(REPLY_EVENT, replies);
    el.dispatchEvent(new CustomEvent(PROBE_EVENT, { composed: true }));
    expect(replies).toHaveBeenCalledTimes(1);
    document.documentElement.removeAttribute('data-quickinspect-reply');
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
