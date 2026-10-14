import {
  PROBE_EVENT,
  REPLY_ATTRIBUTE,
  REPLY_EVENT,
} from '@/shared/types/events';
import { probeEvents } from './events';

describe('probeEvents', () => {
  const payload = JSON.stringify({
    listeners: [
      { type: 'click', origin: 'listener', name: 'go', source: '', flags: [] },
    ],
    framework: null,
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute(REPLY_ATTRIBUTE);
  });

  it('returns the reply dispatched by the main-world bridge', () => {
    const el = document.createElement('button');
    document.body.append(el);
    document.addEventListener(
      PROBE_EVENT,
      (event) => {
        (event.composedPath()[0] as Element).dispatchEvent(
          new CustomEvent(REPLY_EVENT, { detail: payload }),
        );
      },
      { capture: true, once: true },
    );
    expect(probeEvents(el).listeners[0]?.name).toBe('go');
  });

  it('falls back to the attribute when detail is unavailable', () => {
    const el = document.createElement('button');
    document.body.append(el);
    document.addEventListener(
      PROBE_EVENT,
      () => {
        document.documentElement.setAttribute(REPLY_ATTRIBUTE, payload);
      },
      { capture: true, once: true },
    );
    expect(probeEvents(el).listeners).toHaveLength(1);
    expect(document.documentElement.hasAttribute(REPLY_ATTRIBUTE)).toBe(false);
  });

  it('returns an empty result without a bridge or with garbage', () => {
    const el = document.createElement('button');
    document.body.append(el);
    expect(probeEvents(el)).toEqual({ listeners: [], framework: null });
    document.addEventListener(
      PROBE_EVENT,
      () => {
        document.documentElement.setAttribute(REPLY_ATTRIBUTE, '{nope');
      },
      { capture: true, once: true },
    );
    expect(probeEvents(el)).toEqual({ listeners: [], framework: null });
  });
});
