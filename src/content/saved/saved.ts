import { EDITS_STORAGE_PREFIX } from '@/shared/consts';
import { getCssSelector, logger } from '@/shared/util';
import {
  applyDelta,
  EditDelta,
  editDelta,
  editedElements,
  hasEdits,
} from '../edits/edits';

export interface EditRecord extends EditDelta {
  path: string;
  selector: string;
}

export class SavedEdits {
  private records: EditRecord[] = [];
  private enabled = false;
  private observer: MutationObserver | null = null;
  private frame = 0;
  private writes = Promise.resolve();
  private readonly selectors = new WeakMap<Element, string>();

  constructor(private readonly origin = location.origin) {}

  private get key(): string {
    return EDITS_STORAGE_PREFIX + this.origin;
  }

  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
      return;
    }
    chrome.storage.local
      .get(this.key)
      .then((data) => {
        if (!this.enabled) return;
        const stored: unknown = data[this.key];
        this.records = Array.isArray(stored) ? (stored as EditRecord[]) : [];
        for (const el of editedElements()) this.remember(el);
        this.replay();
        this.observe();
      })
      .catch((error: unknown) => {
        logger.warn('Could not load saved edits', error);
      });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.records = [];
  }

  // ? the selector is taken before the first edit, so it still matches the page as it loads next time
  selectorOf(el: Element): string {
    let selector = this.selectors.get(el);
    if (!selector) {
      selector = getCssSelector(el);
      this.selectors.set(el, selector);
    }
    return selector;
  }

  remember(el: Element): void {
    if (!this.enabled || el.getRootNode() !== document) return;
    const path = location.pathname;
    const selector = this.selectorOf(el);
    const delta = editDelta(el);
    this.records = this.records.filter(
      (record) => record.path !== path || record.selector !== selector,
    );
    if (delta) this.records.push({ path, selector, ...delta });
    this.persist();
    this.observe();
  }

  private persist(): void {
    const records = [...this.records];
    this.writes = this.writes
      .then(() =>
        records.length
          ? chrome.storage.local.set({ [this.key]: records })
          : chrome.storage.local.remove(this.key),
      )
      .catch((error: unknown) => {
        logger.warn('Could not save edits', error);
      });
  }

  // ? a re-rendered element comes back without edits, so it is matched again
  private replay(): void {
    for (const record of this.records) {
      if (record.path !== location.pathname) continue;
      let matches: NodeListOf<Element>;
      try {
        matches = document.querySelectorAll(record.selector);
      } catch {
        continue;
      }
      const el = matches.item(0);
      if (matches.length !== 1 || hasEdits(el)) continue;
      this.selectors.set(el, record.selector);
      applyDelta(el, record);
    }
  }

  private observe(): void {
    if (this.observer || !this.records.length) return;
    this.observer = new MutationObserver(() => {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.replay();
      });
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}
