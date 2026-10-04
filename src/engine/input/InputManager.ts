/**
 * One semantic input owner for an active V3 player.
 *
 * It normalises devices (arrows, physical WASD, Enter, Escape, pointer/touch)
 * into a handful of semantic intents and decides, through the pure table in
 * `routing.ts`, who owns each keystroke. It never chooses story actions: the
 * player shell maps intents onto controller events.
 *
 * Why this replaces scattered handlers:
 *  - exactly one capture-phase listener decides eligibility, then calls
 *    `preventDefault()` synchronously, and only for keys it owns;
 *  - held movement is cleared on EVERY loss of ownership (blur, hidden,
 *    scope change, focus leaving the surface, pointer cancel, route change),
 *    so velocity is never kept as hidden input;
 *  - physical presses get ids, so a held key or a double click cannot turn
 *    into several activations.
 *
 * Intents are plain data. The manager touches no story state and calls no
 * model; it is mounted per player and fully removed on `dispose()`.
 */

import { movementCode, movementVector, routeKeydown, topRegistered, type KeyFacts, type MoveCode, type RegisteredScope, type ScopeKind, type TargetKind } from './routing.ts';

export type StopReason = 'blur' | 'hidden' | 'scope_opened' | 'focus_left' | 'pointer_cancel' | 'ineligible' | 'surface_removed' | 'disposed';

export type InputIntent =
  | { type: 'move'; vector: [number, number]; reason: 'input' | StopReason }
  | { type: 'activate'; source: 'key' | 'pointer'; activationId: string; point?: [number, number]; /** Physical key (key source only): lets a shell tell "interact" (E) from "continue" (Enter/Space). */ code?: string }
  | { type: 'cancel'; scope: ScopeKind }
  /** The world has focus and owns the key, but locomotion is not possible now. Hinted once per focus. */
  | { type: 'movement_blocked' };

export interface InputManagerOptions {
  onIntent: (intent: InputIntent) => void;
  /** Observes a trusted gesture (e.g. to unlock audio). It can never consume or cancel it. */
  onTrustedGesture?: (e: Event) => void;
  document?: Document;
  window?: Window;
}

const TAP_SLOP_PX = 10;
const NON_TEXT_INPUT = new Set(['button', 'submit', 'reset', 'image', 'checkbox', 'radio', 'range', 'color', 'file']);
const EDITABLE_ROLES = new Set(['textbox', 'combobox', 'searchbox', 'spinbutton']);
const NATIVE_ROLES = new Set(['button', 'link', 'menuitem', 'tab', 'option', 'checkbox', 'radio', 'switch', 'slider']);

/** Enter/Space by logical key OR physical code: virtual keyboards often send `key` with an empty `code`. */
function isActivationKey(e: Pick<KeyboardEvent, 'key' | 'code'>): boolean {
  return e.key === 'Enter' || e.key === ' ' || e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' || e.code === 'KeyE';
}

export class InputManager {
  private readonly doc: Document;
  private readonly win: Window;
  private readonly onIntent: (i: InputIntent) => void;
  private readonly onTrustedGesture?: (e: Event) => void;

  private attached = false;
  private surface: HTMLElement | null = null;
  private unbindSurface: (() => void) | null = null;
  private scopes: RegisteredScope[] = [];
  private eligible = false;

  private held = new Set<MoveCode>();
  private lastVector: [number, number] = [0, 0];
  private blockedHinted = false;

  private pressSeq = 0;
  /** True while a physical Enter/Space press can still own the click(s) it generates. */
  private pressOpen = false;
  private syntheticSeq = 0;
  private closePress: ReturnType<typeof setTimeout> | null = null;
  private pointerSeq = 0;
  private lastPointerActivation = '';
  private tap: { id: number; x: number; y: number; moved: boolean } | null = null;

  constructor(opts: InputManagerOptions) {
    this.onIntent = opts.onIntent;
    this.onTrustedGesture = opts.onTrustedGesture;
    this.doc = opts.document ?? document;
    this.win = opts.window ?? window;
  }

  /* ------------------------------------------------------- lifecycle --- */

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.win.addEventListener('keydown', this.onKeyDown, true);
    this.win.addEventListener('keyup', this.onKeyUp, true);
    // Attach early (the player does it in a layout effect) so ownership loss is processed before other listeners hear the same event.
    this.win.addEventListener('blur', this.onWindowBlur);
    this.win.addEventListener('pagehide', this.onWindowBlur);
    this.doc.addEventListener('visibilitychange', this.onVisibility);
    this.doc.addEventListener('focusout', this.onFocusOut);
    this.doc.addEventListener('pointerdown', this.onAnyPointerDown, true);
  }

  /** Route change / unmount. Releases everything and stops listening; can be re-attached. */
  dispose(): void {
    this.releaseAll('disposed');
    this.win.removeEventListener('keydown', this.onKeyDown, true);
    this.win.removeEventListener('keyup', this.onKeyUp, true);
    this.win.removeEventListener('blur', this.onWindowBlur);
    this.win.removeEventListener('pagehide', this.onWindowBlur);
    this.doc.removeEventListener('visibilitychange', this.onVisibility);
    this.doc.removeEventListener('focusout', this.onFocusOut);
    this.doc.removeEventListener('pointerdown', this.onAnyPointerDown, true);
    this.attached = false;
    if (this.closePress) clearTimeout(this.closePress);
    this.closePress = null;
    this.pressOpen = false;
    this.scopes = [];
    this.tap = null;
    this.blockedHinted = false;
  }

  /* --------------------------------------------------------- inputs ---- */

  registerWorldSurface(el: HTMLElement): () => void {
    this.unbindSurface?.();
    this.surface = el;
    el.addEventListener('pointerdown', this.onSurfacePointerDown);
    el.addEventListener('pointermove', this.onSurfacePointerMove);
    el.addEventListener('pointerup', this.onSurfacePointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('lostpointercapture', this.onPointerCancel);
    el.addEventListener('focus', this.onSurfaceFocus);
    const unbind = () => {
      el.removeEventListener('pointerdown', this.onSurfacePointerDown);
      el.removeEventListener('pointermove', this.onSurfacePointerMove);
      el.removeEventListener('pointerup', this.onSurfacePointerUp);
      el.removeEventListener('pointercancel', this.onPointerCancel);
      el.removeEventListener('lostpointercapture', this.onPointerCancel);
      el.removeEventListener('focus', this.onSurfaceFocus);
      if (this.surface === el) {
        this.surface = null;
        this.releaseAll('surface_removed');
      }
      this.unbindSurface = null;
    };
    this.unbindSurface = unbind;
    return unbind;
  }

  /** The scopes the current state implies. Called synchronously on every state change. */
  setScopes(next: readonly RegisteredScope[]): void {
    const opened = next.some(s => !this.scopes.includes(s));
    this.scopes = [...next];
    if (opened) this.reconcile('scope_opened');
    if (!next.length) this.blockedHinted = false;
  }

  setMovementEligible(v: boolean): void {
    this.eligible = v;
    if (!v) this.reconcile('ineligible');
  }

  /**
   * Activation identity for a click. A click produced by the keyboard reuses
   * the id of the physical key press that caused it (so a held Enter, which
   * repeats `click`, is one activation); the second click of a double click
   * reuses the first's id; every other pointer click is a new activation.
   *
   * A `detail === 0` click with NO owning key press (screen-reader or switch
   * activation, programmatic `click()`, some virtual keyboards) is a genuine
   * separate activation and gets its own unique `s<n>` id.
   */
  activationIdFor(e: Event): string {
    const d = (e as { detail?: unknown }).detail;
    const detail = typeof d === 'number' ? d : 1;
    if (detail === 0) return this.pressOpen ? `k${this.pressSeq}` : `s${++this.syntheticSeq}`;
    if (detail > 1 && this.lastPointerActivation) return this.lastPointerActivation;
    this.lastPointerActivation = `p${++this.pointerSeq}`;
    return this.lastPointerActivation;
  }

  get heldVector(): [number, number] {
    return movementVector(this.held);
  }

  get topScope(): ScopeKind {
    return topRegistered(this.scopes) ?? (this.surfaceFocused() ? 'world' : 'page');
  }

  /* ---------------------------------------------------- ownership ------ */

  private surfaceFocused(): boolean {
    return !!this.surface && this.doc.activeElement === this.surface;
  }

  private worldOwnsLocomotion(): boolean {
    return this.surfaceFocused() && this.scopes.length === 0 && this.eligible;
  }

  /** If the world no longer owns locomotion, drop every held key now. */
  private reconcile(reason: StopReason): void {
    if (!this.worldOwnsLocomotion()) this.releaseAll(reason);
  }

  private releaseAll(reason: StopReason): void {
    const had = this.held.size > 0 || this.lastVector[0] !== 0 || this.lastVector[1] !== 0;
    this.held.clear();
    this.lastVector = [0, 0];
    if (had) this.onIntent({ type: 'move', vector: [0, 0], reason });
  }

  private emitMove(): void {
    const v = movementVector(this.held);
    if (v[0] === this.lastVector[0] && v[1] === this.lastVector[1]) return;
    this.lastVector = v;
    this.onIntent({ type: 'move', vector: v, reason: 'input' });
  }

  private classify(e: Event): TargetKind {
    const el = (typeof e.composedPath === 'function' ? e.composedPath()[0] : e.target) as Element | null | undefined;
    if (!el || !(el instanceof Element)) return 'other';
    if (el === this.surface) return 'world_surface';
    const tag = el.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return 'editable';
    if (tag === 'INPUT') return NON_TEXT_INPUT.has(((el as HTMLInputElement).type || 'text').toLowerCase()) ? 'native_control' : 'editable';
    if ((el as HTMLElement).isContentEditable) return 'editable';
    const role = el.getAttribute('role');
    if (role && EDITABLE_ROLES.has(role)) return 'editable';
    if (tag === 'BUTTON' || tag === 'SUMMARY' || (tag === 'A' && el.hasAttribute('href')) || (role && NATIVE_ROLES.has(role))) return 'native_control';
    return 'other';
  }

  /* -------------------------------------------------------- keyboard --- */

  private factsOf(e: KeyboardEvent): KeyFacts {
    return { type: e.type as 'keydown' | 'keyup', key: e.key, code: e.code, repeat: e.repeat, isComposing: e.isComposing || e.keyCode === 229, ctrl: e.ctrlKey, meta: e.metaKey, alt: e.altKey, shift: e.shiftKey };
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.isTrusted) this.onTrustedGesture?.(e);
    if (isActivationKey(e)) {
      if (this.closePress) clearTimeout(this.closePress);
      this.closePress = null;
      if (!e.repeat) this.pressSeq++;
      this.pressOpen = true;
    }

    const r = routeKeydown(this.factsOf(e), { target: this.classify(e), scopes: this.scopes, movementEligible: this.eligible });
    // Synchronously, and only for keys the table says we own.
    if (r.preventDefault) e.preventDefault();

    switch (r.action.kind) {
      case 'move_down':
        this.held.add(r.action.code);
        this.emitMove();
        break;
      case 'blocked':
        if (!this.blockedHinted) {
          this.blockedHinted = true;
          this.onIntent({ type: 'movement_blocked' });
        }
        break;
      case 'activate':
        this.onIntent({ type: 'activate', source: 'key', activationId: `k${this.pressSeq}`, code: e.code });
        break;
      case 'cancel':
        this.onIntent({ type: 'cancel', scope: r.action.scope });
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    // Release is honoured wherever focus has gone, so a key can never stay stuck down.
    if (isActivationKey(e)) {
      // Enter clicks on keydown, so the press is over. Space clicks right AFTER keyup, in the same task.
      if (e.key === ' ' || e.code === 'Space') {
        this.closePress = setTimeout(() => { this.pressOpen = false; this.closePress = null; }, 0);
      } else this.pressOpen = false;
    }
    const code = movementCode({ key: e.key, code: e.code });
    if (code && this.held.delete(code)) this.emitMove();
  };

  /* ------------------------------------------------ ownership loss ----- */

  private onWindowBlur = (): void => this.releaseAll('blur');

  private onVisibility = (): void => {
    if (this.doc.visibilityState === 'hidden') this.releaseAll('hidden');
  };

  private onFocusOut = (e: FocusEvent): void => {
    if (e.target === this.surface && e.relatedTarget !== this.surface) this.releaseAll('focus_left');
  };

  private onSurfaceFocus = (): void => {
    this.blockedHinted = false;
  };

  private onPointerCancel = (): void => {
    this.tap = null;
    this.releaseAll('pointer_cancel');
  };

  /* --------------------------------------------------------- pointer --- */

  private onAnyPointerDown = (e: PointerEvent): void => {
    if (e.isTrusted) this.onTrustedGesture?.(e);
  };

  private onSurfacePointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Never act on pointer-down: a touch may be the start of a scroll.
    this.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };

  private onSurfacePointerMove = (e: PointerEvent): void => {
    const t = this.tap;
    if (t && t.id === e.pointerId && Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP_PX) t.moved = true;
  };

  private onSurfacePointerUp = (e: PointerEvent): void => {
    const t = this.tap;
    this.tap = null;
    if (!t || t.id !== e.pointerId || t.moved || !this.surface) return;
    // A tap is the deliberate way into the scene controls.
    this.surface.focus({ preventScroll: true });
    if (this.scopes.length) return;
    const r = this.surface.getBoundingClientRect();
    const nx = r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0;
    const ny = r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0;
    this.onIntent({ type: 'activate', source: 'pointer', activationId: `p${++this.pointerSeq}`, point: [nx, ny] });
  };
}
