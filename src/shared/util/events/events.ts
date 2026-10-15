import {
  EventsInfo,
  PROBE_EVENT,
  REPLY_ATTRIBUTE,
  REPLY_EVENT,
} from '../../types/events';

const EMPTY: EventsInfo = { listeners: [], framework: null, source: null };

function parse(raw: unknown): EventsInfo | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EventsInfo>;
    return {
      listeners: Array.isArray(parsed.listeners) ? parsed.listeners : [],
      framework: parsed.framework ?? null,
      source: parsed.source ?? null,
    };
  } catch {
    return null;
  }
}

export function probeEvents(el: Element): EventsInfo {
  const reply: { value: EventsInfo | null } = { value: null };
  const onReply = (event: Event) => {
    reply.value = parse((event as CustomEvent<unknown>).detail);
  };

  el.addEventListener(REPLY_EVENT, onReply, true);
  el.dispatchEvent(new CustomEvent(PROBE_EVENT, { composed: true }));
  el.removeEventListener(REPLY_EVENT, onReply, true);

  const fallback = document.documentElement.getAttribute(REPLY_ATTRIBUTE);
  document.documentElement.removeAttribute(REPLY_ATTRIBUTE);

  return reply.value ?? parse(fallback) ?? EMPTY;
}
