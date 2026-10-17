import { DEFAULT_SETTINGS } from '@/shared/consts';
import { ElementInfo, LensSettings, ModifierKey } from '@/shared/types';
import {
  copyText,
  deepElementFromPoint,
  formatSource,
  inspectElement,
  isEditable,
  isOwnNode,
  mapToOriginal,
  openInEditor,
  resolveNextFrame,
  truncate,
  viteBase,
} from '@/shared/util';
import { actionByCode, CopyAction } from './actions';
import {
  EditField,
  hasEdits,
  readField,
  revertEdits,
  writeField,
} from './edits';
import { LensHost } from './host';
import { Overlay } from './overlay';
import { Panel } from './panel';
import { Toast } from './toast';

type FrameWork = 'retarget' | 'refresh' | 'move';

const MODIFIER_FLAG: Record<
  ModifierKey,
  'altKey' | 'ctrlKey' | 'shiftKey' | 'metaKey'
> = {
  Alt: 'altKey',
  Control: 'ctrlKey',
  Shift: 'shiftKey',
  Meta: 'metaKey',
};

export class Inspector {
  private readonly host = new LensHost();
  private readonly overlay = new Overlay(this.host.root);
  private readonly toast = new Toast(this.host.root);
  private readonly panel = new Panel(this.host.root, {
    copy: (action) => {
      this.copy(action);
    },
    open: () => {
      this.openSource();
    },
    read: (field) => (this.current ? readField(this.current, field) : ''),
    write: (field, value) => this.write(field, value),
    revert: () => {
      this.revert();
    },
  });

  private settings: LensSettings = { ...DEFAULT_SETTINGS };
  private holding = false;
  private pinned = false;
  private current: Element | null = null;
  private shown: Element | null = null;
  private info: ElementInfo | null = null;
  private pointer = { x: -1, y: -1 };
  private frame = 0;
  private readonly work = new Set<FrameWork>();

  attach(): void {
    const options = { capture: true };
    window.addEventListener('keydown', this.onKeyDown, options);
    window.addEventListener('keyup', this.onKeyUp, options);
    window.addEventListener('mousemove', this.onMouseMove, {
      capture: true,
      passive: true,
    });
    window.addEventListener('mousedown', this.onMouseDown, options);
    window.addEventListener('click', this.onClick, options);
    window.addEventListener('auxclick', this.onMouseDown, options);
    window.addEventListener('contextmenu', this.onMouseDown, options);
    window.addEventListener('scroll', this.onScroll, {
      capture: true,
      passive: true,
    });
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    const options = { capture: true };
    window.removeEventListener('keydown', this.onKeyDown, options);
    window.removeEventListener('keyup', this.onKeyUp, options);
    window.removeEventListener('mousemove', this.onMouseMove, options);
    window.removeEventListener('mousedown', this.onMouseDown, options);
    window.removeEventListener('click', this.onClick, options);
    window.removeEventListener('auxclick', this.onMouseDown, options);
    window.removeEventListener('contextmenu', this.onMouseDown, options);
    window.removeEventListener('scroll', this.onScroll, options);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlur);
    this.close();
    this.host.unmount();
  }

  setSettings(next: LensSettings): void {
    this.settings = next;
    this.overlay.setBoxModel(next.showBoxModel);
    if (!next.enabled) {
      this.close();
      return;
    }
    if (this.current && this.visible) this.refresh();
  }

  private get visible(): boolean {
    return this.holding || this.pinned;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.settings.enabled || this.panel.editing || this.typing(event)) {
      return;
    }

    if (event.key === this.settings.modifier) {
      if (!this.holding) {
        this.setHolding(true);
        this.host.mount();
        this.schedule('retarget');
      }
      return;
    }

    if (!this.visible) return;

    if (event.code === 'Escape') {
      this.swallow(event);
      this.close();
      return;
    }

    if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
      this.swallow(event);
      this.navigate(event.code === 'ArrowUp' ? 'parent' : 'child');
      return;
    }

    if (this.browserShortcut(event)) return;

    if (event.code === 'KeyO') {
      this.swallow(event);
      this.openSource();
      return;
    }

    const action = actionByCode(event.code);
    if (action) {
      this.swallow(event);
      this.copy(action);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (event.key !== this.settings.modifier || !this.holding) return;
    // ? a lone Alt keyup focuses the Chrome menu bar on Windows and Linux
    event.preventDefault();
    this.setHolding(false);
    if (!this.pinned) this.hideAll();
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.pointer = { x: event.clientX, y: event.clientY };
    if (this.holding && !this.pinned) this.schedule('retarget');
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (this.held(event) && this.visible && !isOwnNode(event.target as Node)) {
      this.swallow(event);
    }
  };

  private readonly onClick = (event: MouseEvent): void => {
    if (isOwnNode(event.target as Node)) return;

    if (this.held(event) && this.visible) {
      this.swallow(event);
      if (this.pinned) {
        this.unpin();
        return;
      }
      const moved = this.targetClick(event);
      if (this.current) this.pin();
      if (moved) this.panel.position(this.pointer.x, this.pointer.y);
      return;
    }

    if (this.pinned) {
      this.close();
    }
  };

  // ? a quick tap clicks before the frame that would inspect the touched element
  private targetClick(event: MouseEvent): boolean {
    if (event.detail === 0) return false;
    const target = deepElementFromPoint(event.clientX, event.clientY);
    if (!target || isOwnNode(target) || target === this.current) return false;
    this.pointer = { x: event.clientX, y: event.clientY };
    this.current = target;
    return true;
  }

  // ? scrolling moves the element but changes none of its values
  private readonly onScroll = (): void => {
    if (this.visible && this.current) this.schedule('move');
  };

  private readonly onResize = (): void => {
    if (this.visible && this.current) this.schedule('refresh');
  };

  private readonly onBlur = (): void => {
    this.setHolding(false);
    if (!this.pinned) this.hideAll();
  };

  private readonly onTouch = (event: TouchEvent): void => {
    const touch = event.touches.item(0);
    if (!touch || isOwnNode(event.target as Node)) return;
    this.pointer = { x: touch.clientX, y: touch.clientY };
    if (this.pinned) return;
    // ? keep the page still so the finger inspects instead of scrolling
    if (event.type === 'touchmove' && event.cancelable) event.preventDefault();
    this.schedule('retarget');
  };

  // ? touch listeners only exist while the key is held, so normal scrolling never waits on them
  private setHolding(holding: boolean): void {
    if (this.holding === holding) return;
    this.holding = holding;
    if (holding) {
      window.addEventListener('touchstart', this.onTouch, {
        capture: true,
        passive: true,
      });
      window.addEventListener('touchmove', this.onTouch, {
        capture: true,
        passive: false,
      });
    } else {
      window.removeEventListener('touchstart', this.onTouch, { capture: true });
      window.removeEventListener('touchmove', this.onTouch, { capture: true });
    }
  }

  private modifierHeld(event: MouseEvent | KeyboardEvent): boolean {
    return event[MODIFIER_FLAG[this.settings.modifier]];
  }

  // ? the click after a tap may not report the key, so holding it counts too
  private held(event: MouseEvent): boolean {
    return this.holding || this.modifierHeld(event);
  }

  private typing(event: KeyboardEvent): boolean {
    if (!isEditable(event.composedPath().at(0) ?? null)) return false;
    // ? Shift is part of normal typing, so it never inspects from a text field
    if (this.settings.modifier === 'Shift') return true;
    return event.key !== this.settings.modifier && !this.modifierHeld(event);
  }

  private browserShortcut(event: KeyboardEvent): boolean {
    const { modifier } = this.settings;
    return (
      (event.ctrlKey && modifier !== 'Control') ||
      (event.metaKey && modifier !== 'Meta')
    );
  }

  private swallow(event: Event): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private schedule(work: FrameWork): void {
    this.work.add(work);
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.runFrame();
    });
  }

  private runFrame(): void {
    const work = new Set(this.work);
    this.work.clear();
    if (work.has('retarget') && !this.pinned && this.inspectUnderPointer()) {
      return;
    }
    if (work.has('refresh')) {
      this.refresh();
    } else if (work.has('move')) {
      this.move();
    }
  }

  // ? true when it inspected a different element
  private inspectUnderPointer(): boolean {
    const { x, y } = this.pointer;
    if (x < 0 || y < 0) return false;
    const target = deepElementFromPoint(x, y);
    if (!target || isOwnNode(target)) return false;
    if (target === this.current && this.panel.visible) {
      this.panel.position(x, y);
      return false;
    }
    this.current = target;
    this.refresh();
    this.panel.position(x, y);
    return true;
  }

  private move(): void {
    const target = this.current;
    if (!target || !this.info) return;
    if (!target.isConnected) {
      this.hideAll();
      return;
    }
    this.overlay.show(target, this.info.box, this.info.summary);
  }

  private refresh(): void {
    const target = this.current;
    if (!target?.isConnected) {
      this.hideAll();
      return;
    }
    const keepScroll = target === this.shown;
    this.shown = target;
    this.info = inspectElement(target);
    this.resolveSource(target, this.info);
    this.overlay.show(target, this.info.box, this.info.summary);
    this.panel.render(this.info, this.settings, {
      edited: hasEdits(target),
      keepScroll,
    });
    this.panel.show();
  }

  private write(field: EditField, value: string | null): boolean {
    const target = this.current;
    if (!target || !this.pinned || !this.settings.allowEdit) return false;
    const written = writeField(target, field, value);
    if (written) this.refresh();
    return written;
  }

  private revert(): void {
    const target = this.current;
    if (!target) return;
    revertEdits(target);
    this.refresh();
    this.toast.show('Edits reset', this.info?.summary ?? '');
  }

  private navigate(direction: 'parent' | 'child'): void {
    if (!this.current) return;
    const next =
      direction === 'parent'
        ? this.current.parentElement
        : this.current.firstElementChild;
    if (!next || next === document.documentElement || isOwnNode(next)) return;
    this.current = next;
    if (!this.pinned) this.pin();
    this.refresh();
  }

  private pin(): void {
    this.pinned = true;
    this.panel.setPinned(true);
    this.refresh();
  }

  private unpin(): void {
    this.pinned = false;
    this.panel.setPinned(false);
    if (this.holding) {
      this.schedule('retarget');
    } else {
      this.hideAll();
    }
  }

  private close(): void {
    this.pinned = false;
    this.setHolding(false);
    this.panel.setPinned(false);
    this.hideAll();
  }

  private hideAll(): void {
    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.work.clear();
    }
    this.overlay.hide();
    this.panel.hide();
    this.current = null;
    this.shown = null;
    this.info = null;
  }

  private resolveSource(target: Element, info: ElementInfo): void {
    const source = info.source;
    if (!source || source.mapped || !info.devServer) return;
    const pending =
      info.devServer === 'vite'
        ? mapToOriginal(source, viteBase())
        : resolveNextFrame(source);
    pending.then((mapped) => {
      if (!mapped || this.current !== target || this.info !== info) return;
      info.source = { ...mapped, mapped: true };
      this.panel.render(info, this.settings, {
        edited: hasEdits(target),
        keepScroll: true,
      });
    });
  }

  private openSource(): void {
    const source = this.info?.source;
    if (!source) {
      this.toast.show('No source location for this element');
      return;
    }
    const location = formatSource(source);
    if (!this.info?.devServer) {
      this.toast.show('No dev server to open the editor', location);
      return;
    }
    openInEditor(source, this.info.devServer).then((opened) => {
      this.toast.show(
        opened ? 'Opened in editor' : 'Editor did not open',
        location,
      );
    });
  }

  private copy(action: CopyAction): void {
    if (!this.current || !this.info) return;
    const value = action.value(this.info, this.current);
    if (!value) {
      this.toast.show(`Nothing to copy for ${action.label}`);
      return;
    }
    copyText(value).then((copied) => {
      this.toast.show(
        copied ? `Copied ${action.label}` : `Could not copy ${action.label}`,
        copied ? truncate(value.replace(/\s+/g, ' '), 100) : '',
      );
      if (copied) this.panel.flash(action);
    });
  }
}
