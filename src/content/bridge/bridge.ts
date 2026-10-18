import type {
  EventListenerInfo,
  EventOrigin,
  EventsInfo,
  FrameworkInfo,
} from '@/shared/types/events';
import type { SourceInfo } from '@/shared/types/source';
import {
  PROBE_EVENT,
  REPLY_ATTRIBUTE,
  REPLY_EVENT,
} from '@/shared/types/events';

interface Entry {
  listener: EventListenerOrEventListenerObject;
  capture: boolean;
  once: boolean;
  passive: boolean;
  unwatch?: () => void;
}

type Handler = (...args: unknown[]) => unknown;
type Bag = Record<string, unknown>;

const OWN = new Set<string>([PROBE_EVENT, REPLY_EVENT]);
const registry = new WeakMap<EventTarget, Map<string, Entry[]>>();

// ? null is a valid options value for the native call, so only real objects are read
function flagsOf(options?: boolean | AddEventListenerOptions) {
  if (options && typeof options === 'object') {
    return {
      capture: Boolean(options.capture),
      once: Boolean(options.once),
      passive: Boolean(options.passive),
      signal: options.signal,
    };
  }
  return {
    capture: Boolean(options),
    once: false,
    passive: false,
    signal: undefined,
  };
}

const proto = EventTarget.prototype;
const nativeAdd = proto.addEventListener;
const nativeRemove = proto.removeEventListener;

function drop(entries: Entry[], entry: Entry): void {
  const index = entries.indexOf(entry);
  if (index >= 0) entries.splice(index, 1);
  entry.unwatch?.();
}

// ? the browser removes once and aborted listeners itself, without calling removeEventListener
function watchRemoval(
  target: EventTarget,
  type: string,
  entries: Entry[],
  entry: Entry,
  signal: AbortSignal | undefined,
): void {
  if (!entry.once && !signal) return;
  const forget = () => {
    drop(entries, entry);
  };
  // ? added right before the page's listener, so it runs exactly when that one does
  if (entry.once) {
    nativeAdd.call(target, type, forget, {
      capture: entry.capture,
      once: true,
      passive: true,
    });
  }
  if (signal) nativeAdd.call(signal, 'abort', forget, { once: true });
  entry.unwatch = () => {
    if (entry.once) nativeRemove.call(target, type, forget, entry.capture);
    if (signal) nativeRemove.call(signal, 'abort', forget);
  };
}

function track(
  target: EventTarget,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): void {
  const { signal, ...flags } = flagsOf(options);
  // ? the browser never adds a listener whose signal has already aborted
  if (signal?.aborted) return;
  let byType = registry.get(target);
  if (!byType) {
    byType = new Map();
    registry.set(target, byType);
  }
  const entries = byType.get(type) ?? [];
  byType.set(type, entries);
  // ? nor one that is already registered for the same phase
  const duplicate = entries.some(
    (e) => e.listener === listener && e.capture === flags.capture,
  );
  if (duplicate) return;
  const entry: Entry = { listener, ...flags };
  entries.push(entry);
  watchRemoval(target, type, entries, entry, signal);
}

function patchListeners(): void {
  proto.addEventListener = function patchedAdd(
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions,
  ) {
    if (listener && !OWN.has(type)) {
      // ? this runs inside every page, so a bookkeeping failure must never stop the page's own listener
      try {
        track(this, type, listener, options);
      } catch {
        // the listener just goes unlisted
      }
    }
    nativeAdd.call(this, type, listener, options);
  };

  proto.removeEventListener = function patchedRemove(
    this: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions,
  ) {
    const entries = registry.get(this)?.get(type);
    if (entries && listener) {
      const capture = flagsOf(options).capture;
      const entry = entries.find(
        (e) => e.listener === listener && e.capture === capture,
      );
      if (entry) drop(entries, entry);
    }
    nativeRemove.call(this, type, listener, options);
  };
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function squash(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function describe(fn: unknown): { name: string; source: string } {
  if (typeof fn !== 'function') {
    const handler = (fn as { handleEvent?: unknown } | null)?.handleEvent;
    return typeof handler === 'function'
      ? { name: 'handleEvent', source: squash(String(handler)).slice(0, 160) }
      : { name: 'object', source: '' };
  }
  let source = '';
  try {
    source = squash(String(fn));
  } catch {
    source = '';
  }
  if (source.includes('[native code]')) source = '';
  return { name: fn.name || 'anonymous', source: source.slice(0, 160) };
}

function entry(
  type: string,
  origin: EventOrigin,
  fn: unknown,
  flags: string[] = [],
): EventListenerInfo {
  return { type, origin, flags, ...describe(fn) };
}

function ownListeners(el: Element): EventListenerInfo[] {
  const result: EventListenerInfo[] = [];
  const byType = registry.get(el);
  if (!byType) return result;
  for (const [type, entries] of byType) {
    for (const e of entries) {
      const flags = [
        e.capture ? 'capture' : '',
        e.once ? 'once' : '',
        e.passive ? 'passive' : '',
      ].filter(Boolean);
      result.push(entry(type, 'listener', e.listener, flags));
    }
  }
  return result;
}

function inlineHandlers(el: Element): EventListenerInfo[] {
  const result: EventListenerInfo[] = [];
  const seen = new Set<string>();
  let current: unknown = el;
  while (current && current !== Object.prototype) {
    for (const key of Object.getOwnPropertyNames(current)) {
      if (!key.startsWith('on') || seen.has(key)) continue;
      seen.add(key);
      let value: unknown;
      try {
        value = (el as unknown as Bag)[key];
      } catch {
        continue;
      }
      if (typeof value === 'function') {
        result.push(entry(key.slice(2), 'inline', value));
      }
    }
    current = Object.getPrototypeOf(current);
  }
  return result;
}

function reactEventName(prop: string): { type: string; capture: boolean } {
  const capture = prop.endsWith('Capture');
  const base = capture ? prop.slice(2, -7) : prop.slice(2);
  const special: Record<string, string> = {
    DoubleClick: 'dblclick',
    ChangeText: 'input',
  };
  return { type: special[base] ?? base.toLowerCase(), capture };
}

// ? production builds minify component functions to names like "li"; only PascalCase names of 3+ characters are shown
const READABLE_NAME = /^[A-Z][A-Za-z0-9_$]{2,}$/;

function readable(name: unknown): string {
  return typeof name === 'string' && READABLE_NAME.test(name) ? name : '';
}

function reactName(type: unknown): string {
  if (typeof type === 'function') {
    return (
      readable((type as unknown as Bag).displayName) || readable(type.name)
    );
  }
  if (type && typeof type === 'object') {
    const wrapper = type as Bag;
    return (
      readable(wrapper.displayName) || reactName(wrapper.render ?? wrapper.type)
    );
  }
  return '';
}

function reactInfo(el: Element): {
  listeners: EventListenerInfo[];
  framework: FrameworkInfo | null;
} {
  const bag = el as unknown as Bag;
  const propsKey = Object.keys(bag).find((k) => k.startsWith('__reactProps$'));
  const fiberKey = Object.keys(bag).find((k) => k.startsWith('__reactFiber$'));
  if (!propsKey && !fiberKey) return { listeners: [], framework: null };

  const listeners: EventListenerInfo[] = [];
  const props = (propsKey ? bag[propsKey] : null) as Bag | null;
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (/^on[A-Z]/.test(key) && typeof value === 'function') {
        const { type, capture } = reactEventName(key);
        listeners.push(entry(type, 'React', value, capture ? ['capture'] : []));
      }
    }
  }

  let component = '';
  let fiber = (fiberKey ? bag[fiberKey] : null) as Bag | null;
  let hops = 0;
  while (fiber && hops < 30 && !component) {
    component = reactName(fiber.type);
    fiber = fiber.return as Bag | null;
    hops += 1;
  }

  return { listeners, framework: { name: 'React', component } };
}

function vueOwner(el: Element): Bag | null {
  let current: Element | null = el;
  for (let hops = 0; current && hops < 40; hops += 1) {
    const bag = current as unknown as Bag;
    if (bag.__vueParentComponent || bag.__vue__) return bag;
    current = current.parentElement;
  }
  return null;
}

function vueInfo(el: Element): {
  listeners: EventListenerInfo[];
  framework: FrameworkInfo | null;
} {
  const bag = el as unknown as Bag;
  const listeners: EventListenerInfo[] = [];
  const invokers = bag._vei as
    Record<string, { value?: unknown } | undefined> | undefined;
  if (invokers) {
    for (const [key, invoker] of Object.entries(invokers)) {
      const fn = invoker?.value;
      const handlers = Array.isArray(fn) ? fn : [fn];
      for (const handler of handlers) {
        if (typeof handler === 'function') {
          listeners.push(entry(key.slice(2).toLowerCase(), 'Vue', handler));
        }
      }
    }
  }

  const owner = vueOwner(el);
  const parent = owner?.__vueParentComponent as Bag | undefined;
  const legacy = owner?.__vue__ as Bag | undefined;
  let component = '';
  if (parent) {
    const type = parent.type as Bag | undefined;
    component = str(type?.name) || str(type?.__name);
  } else if (legacy) {
    const options = legacy.$options as Bag | undefined;
    component = str(options?.name) || str(options?._componentTag);
  }

  if (!parent && !legacy && !invokers)
    return { listeners: [], framework: null };
  return { listeners, framework: { name: 'Vue', component } };
}

function otherFramework(el: Element): FrameworkInfo | null {
  const bag = el as unknown as Bag;
  // ? Angular stamps ng-version on its root host; __ngContext__ only reaches a component's direct children
  if ('__ngContext__' in bag || el.closest('[ng-version]')) {
    const ng = (window as unknown as Bag).ng as Bag | undefined;
    const getComponent = ng?.getComponent as Handler | undefined;
    const getOwner = ng?.getOwningComponent as Handler | undefined;
    let component = '';
    try {
      // ? a component host names its own component; anything else names the component whose template holds it
      const instance = ((getComponent ? getComponent(el) : null) ??
        (getOwner ? getOwner(el) : null)) as Bag | null;
      component = instance
        ? readable((instance.constructor as Handler).name)
        : '';
    } catch {
      component = '';
    }
    return { name: 'Angular', component };
  }
  const svelte = bag.__svelte_meta as { loc?: { file?: string } } | undefined;
  if (svelte) {
    return {
      name: 'Svelte',
      component: svelte.loc?.file?.split('/').pop() ?? '',
    };
  }
  if (el.closest('[q\\:container]')) return { name: 'Qwik', component: '' };
  return null;
}

function jqueryListeners(el: Element): EventListenerInfo[] {
  const jq = (window as unknown as Bag).jQuery as Bag | undefined;
  const data = jq?._data as Handler | undefined;
  if (!data) return [];
  let events:
    Record<string, { handler?: unknown; namespace?: string }[]> | undefined;
  try {
    events = data(el, 'events') as typeof events;
  } catch {
    return [];
  }
  const result: EventListenerInfo[] = [];
  for (const [type, handlers] of Object.entries(events ?? {})) {
    for (const h of handlers) {
      result.push(
        entry(
          type,
          'jQuery',
          h.handler,
          h.namespace ? [`.${h.namespace}`] : [],
        ),
      );
    }
  }
  return result;
}

const STACK_FRAME = /\((?:https?:\/\/[^/]+)?\/(.+?)(?:\?[^)]*?)?:(\d+):(\d+)\)/;
const SERVER_FRAME =
  /(?:about|rsc):\/\/React\/[^/]+\/(.+?)(?:\?\d+)?:(\d+):(\d+)\)?$/;
const INTERNAL_FRAME =
  /node_modules|\/@vite\/|\/@react-refresh|react-dom|react-jsx|react-server-dom|next_dist|react-stack-top-frame/;

function serverFile(encoded: string): string {
  const file = decodeURIComponent(encoded);
  if (!file.startsWith('file://')) return file;
  return file.slice('file://'.length).replace(/^\/([A-Za-z]:)/, '$1');
}

function reactStackSource(stack: string): SourceInfo | null {
  for (const frame of stack.split('\n')) {
    if (INTERNAL_FRAME.test(frame)) continue;
    const server = SERVER_FRAME.exec(frame);
    const match = server ?? STACK_FRAME.exec(frame);
    if (!match?.[1]) continue;
    return {
      file: server ? serverFile(match[1]) : match[1],
      line: Number(match[2]),
      column: Number(match[3]),
      origin: 'react',
      mapped: false,
    };
  }
  return null;
}

function reactSource(el: Element): SourceInfo | null {
  const bag = el as unknown as Bag;
  const fiberKey = Object.keys(bag).find((k) => k.startsWith('__reactFiber$'));
  let fiber = (fiberKey ? bag[fiberKey] : null) as Bag | null;
  let hops = 0;
  while (fiber && hops < 30) {
    const debug = fiber._debugSource as Bag | undefined;
    if (debug && typeof debug.fileName === 'string') {
      return {
        file: debug.fileName,
        line: typeof debug.lineNumber === 'number' ? debug.lineNumber : null,
        column:
          typeof debug.columnNumber === 'number' ? debug.columnNumber : null,
        origin: 'react',
        mapped: true,
      };
    }
    const stack = fiber._debugStack as { stack?: unknown } | undefined;
    if (stack && typeof stack.stack === 'string') {
      const parsed = reactStackSource(stack.stack);
      if (parsed) return parsed;
    }
    fiber = fiber.return as Bag | null;
    hops += 1;
  }
  return null;
}

function svelteSource(el: Element): SourceInfo | null {
  const meta = (el as unknown as Bag).__svelte_meta as
    { loc?: { file?: unknown; line?: unknown; column?: unknown } } | undefined;
  const loc = meta?.loc;
  if (!loc || typeof loc.file !== 'string') return null;
  return {
    file: loc.file,
    line: typeof loc.line === 'number' ? loc.line : null,
    column: typeof loc.column === 'number' ? loc.column + 1 : null,
    origin: 'svelte',
    mapped: true,
  };
}

function vueSource(el: Element): SourceInfo | null {
  const parent = vueOwner(el)?.__vueParentComponent as Bag | undefined;
  const file = (parent?.type as Bag | undefined)?.__file;
  return typeof file === 'string'
    ? { file, line: null, column: null, origin: 'vue', mapped: true }
    : null;
}

export function collectSource(el: Element): SourceInfo | null {
  return svelteSource(el) ?? reactSource(el) ?? vueSource(el);
}

export function collectEvents(el: Element): EventsInfo {
  const react = reactInfo(el);
  const vue = vueInfo(el);
  const listeners = [
    ...ownListeners(el),
    ...inlineHandlers(el),
    ...react.listeners,
    ...vue.listeners,
    ...jqueryListeners(el),
  ];
  const framework = react.framework ?? vue.framework ?? otherFramework(el);
  return { listeners, framework, source: collectSource(el) };
}

function answerProbes(): void {
  nativeAdd.call(
    document,
    PROBE_EVENT,
    (event: Event) => {
      const target = event.composedPath()[0];
      if (!(target instanceof Element)) return;
      let payload = '{"listeners":[],"framework":null,"source":null}';
      try {
        payload = JSON.stringify(collectEvents(target));
      } catch {
        payload = '{"listeners":[],"framework":null,"source":null}';
      }
      document.documentElement.setAttribute(REPLY_ATTRIBUTE, payload);
      target.dispatchEvent(new CustomEvent(REPLY_EVENT, { detail: payload }));
    },
    true,
  );
}

const INSTALLED = Symbol.for('quickinspect.bridge');
const scope = window as unknown as Record<symbol, boolean | undefined>;

if (!scope[INSTALLED]) {
  scope[INSTALLED] = true;
  patchListeners();
  answerProbes();
}
