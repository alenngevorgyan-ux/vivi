/**
 * DOM focus ownership for the V3 player.
 *
 * The InputManager owns KEYS; this owns FOCUS. Rules:
 *  - the world has one explicit focusable surface (a named group, never
 *    `role=application`); entering it is intentional (click/tap it, Tab to it,
 *    or press the visible "Enter scene controls" button);
 *  - Tab always leaves the surface normally; nothing traps focus except a
 *    semantically modal dialog;
 *  - a modal dialog contains Tab and makes everything outside it `inert` (the
 *    player AND the page chrome around it), so nothing behind it can take focus
 *    or be activated;
 *  - closing restores the invoking control; if it vanished, focus goes to the
 *    world-entry button and the change is announced;
 *  - focus moves only on an explicit open, close, handoff or entry, never as a
 *    side effect of a modality or phase change;
 *  - a heading that opens the reveal is focused exactly once;
 *  - inputs, textareas, selects and contenteditable keep native keyboard
 *    behaviour (the InputManager classifies them and stays out).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { InputManager } from '../../../engine/input/InputManager';

export interface FocusApi {
  manager: InputManager;
  registerWorldSurface(el: HTMLElement): () => void;
  registerEntryButton(el: HTMLElement): () => void;
  /** Intentional entry into the scene controls. Never scrolls. */
  focusWorld(): void;
  /** Escape from the world: release to the visible entry button. */
  releaseWorld(): void;
  /** After a scene swap: put focus back on the world only if it would otherwise be lost. */
  handoffToWorld(): void;
  /** Restore focus to an invoker that may have disappeared. */
  restore(invoker: Element | null): void;
  announce(message: string): void;
  /** Make the background inert (true modal). Returns the release function. */
  pushInert(): () => void;
}

const FocusContext = createContext<FocusApi | null>(null);
const OverlayContext = createContext<HTMLElement | null>(null);

export function useFocusCoordinator(): FocusApi {
  const api = useContext(FocusContext);
  if (!api) throw new Error('useFocusCoordinator must be used inside <FocusCoordinatorProvider>.');
  return api;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[contenteditable=""],[contenteditable="true"],[tabindex]:not([tabindex="-1"])';
const visible = (el: HTMLElement) => el.getClientRects().length > 0;
const focusables = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(visible);
const focusNoScroll = (el: Element | null | undefined) => (el as HTMLElement | null | undefined)?.focus?.({ preventScroll: true });

export function FocusCoordinatorProvider({ manager, children }: { manager: InputManager; children: ReactNode }) {
  const surface = useRef<HTMLElement | null>(null);
  const entry = useRef<HTMLElement | null>(null);
  const inertDepth = useRef(0);
  const inerted = useRef<Element[]>([]);
  const overlayRef = useRef<HTMLElement | null>(null);
  const [overlay, setOverlay] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState('');
  const tick = useRef(0);

  const api = useMemo<FocusApi>(
    () => ({
      manager,
      registerWorldSurface(el) {
        surface.current = el;
        const unbind = manager.registerWorldSurface(el);
        return () => {
          unbind();
          if (surface.current === el) surface.current = null;
        };
      },
      registerEntryButton(el) {
        entry.current = el;
        return () => {
          if (entry.current === el) entry.current = null;
        };
      },
      focusWorld() {
        focusNoScroll(surface.current);
      },
      releaseWorld() {
        if (document.activeElement === surface.current) focusNoScroll(entry.current);
      },
      handoffToWorld() {
        const a = document.activeElement;
        if (!a || a === document.body || a === surface.current || !document.contains(a)) focusNoScroll(surface.current);
      },
      restore(invoker) {
        const a = document.activeElement;
        const lost = !a || a === document.body || !document.contains(a);
        if (invoker && invoker.isConnected) {
          if (lost) focusNoScroll(invoker);
        } else if (lost) {
          focusNoScroll(entry.current ?? surface.current);
          api.announce('The control you used is no longer available. Focus moved to the scene controls.');
        }
      },
      announce(m) {
        // A trailing zero-width character makes a repeated message re-announce.
        setMessage(m + (tick.current++ % 2 ? '​' : ''));
      },
      pushInert() {
        // Everything outside the overlay, up to <body>, becomes inert: not only the player but the page chrome around it.
        // Inert content cannot be focused or activated, and is hidden from assistive technology while the dialog is open.
        if (inertDepth.current++ === 0 && overlayRef.current) {
          let node: Element = overlayRef.current;
          while (node.parentElement && node !== document.body) {
            for (const sib of Array.from(node.parentElement.children)) {
              if (sib === node || sib.hasAttribute('inert') || sib.hasAttribute('data-v3-keep-live') || /^(SCRIPT|STYLE|LINK|META)$/.test(sib.tagName)) continue;
              sib.setAttribute('inert', '');
              inerted.current.push(sib);
            }
            node = node.parentElement;
          }
        }
        let released = false;
        return () => {
          if (released) return;
          released = true;
          inertDepth.current = Math.max(0, inertDepth.current - 1);
          // Synchronous, so the invoker is focusable again the moment the dialog closes.
          if (inertDepth.current === 0) {
            for (const el of inerted.current) el.removeAttribute('inert');
            inerted.current = [];
          }
        };
      },
    }),
    [manager]
  );

  return (
    <FocusContext.Provider value={api}>
      <OverlayContext.Provider value={overlay}>
        {children}
        <div
          ref={el => {
            overlayRef.current = el;
            setOverlay(el);
          }}
          data-v3-overlay=""
        />
        <div role="status" aria-live="polite" className="v3-sr-only" data-testid="announcer" data-v3-keep-live="">
          {message}
        </div>
      </OverlayContext.Provider>
    </FocusContext.Provider>
  );
}

/* ----------------------------------------------------------- the world --- */

export function WorldSurface({ label, describedBy, className, children }: { label: string; describedBy?: string; className?: string; children?: ReactNode }) {
  const api = useFocusCoordinator();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => api.registerWorldSurface(ref.current!), [api]);
  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      data-testid="world-surface"
      data-v3-world-surface=""
      className={className}
      // Targets stay tappable and the page stays scrollable; only a deliberate tap focuses the surface.
      style={{ touchAction: 'manipulation' }}
    >
      {children}
    </div>
  );
}

/** The visible way into the scene controls, for people who do not tap the stage. */
export function WorldEntryButton({ children, className, onEnter }: { children: ReactNode; className?: string; onEnter?: () => void }) {
  const api = useFocusCoordinator();
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => api.registerEntryButton(ref.current!), [api]);
  return (
    <button ref={ref} type="button" data-testid="entry-button" className={className} onClick={() => (onEnter?.(), api.focusWorld())}>
      {children}
    </button>
  );
}

/* ------------------------------------------------------------- dialogs --- */

export interface ScopeDialogProps {
  open: boolean;
  /** A semantically modal dialog contains Tab and makes the background inert. */
  modal: boolean;
  label: string;
  /** Re-focus the dialog's initial target when its content mode changes (not on every render). */
  focusKey?: string;
  testId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Focus mechanics only. Whether a dialog is open, and which input scope it
 * implies, comes from the controller snapshot; this component never decides.
 */
export function ScopeDialog({ open, modal, label, focusKey, testId, className, children }: ScopeDialogProps) {
  const api = useFocusCoordinator();
  const overlay = useContext(OverlayContext);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Lifecycle: remember the invoker, make the background inert if modal, restore on close.
  useEffect(() => {
    if (!open) return;
    const invoker = document.activeElement;
    const release = modal ? api.pushInert() : undefined;
    return () => {
      release?.();
      api.restore(invoker);
    };
  }, [open, modal, api]);

  // Initial focus: once per open, and again only when the content mode changes.
  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    const target = root.querySelector<HTMLElement>('[data-v3-initial-focus]') ?? focusables(root)[0] ?? root;
    focusNoScroll(target);
  }, [open, focusKey, overlay]);

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!modal || e.key !== 'Tab' || e.nativeEvent.isComposing) return;
      const root = rootRef.current;
      if (!root) return;
      const items = focusables(root);
      if (items.length === 0) {
        e.preventDefault();
        focusNoScroll(root);
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === root)) {
        e.preventDefault();
        focusNoScroll(last);
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        focusNoScroll(first);
      }
    },
    [modal]
  );

  if (!open || !overlay) return null;
  return createPortal(
    <div ref={rootRef} role="dialog" aria-modal={modal ? true : undefined} aria-label={label} tabIndex={-1} data-testid={testId} data-v3-dialog={modal ? 'modal' : 'panel'} className={className} onKeyDown={onKeyDown}>
      {children}
    </div>,
    overlay
  );
}

/** The reveal's heading takes focus once, never again. */
export function RevealHeading({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    ref.current?.focus();
  }, []);
  return (
    <h2 ref={ref} tabIndex={-1} data-testid="reveal-heading">
      {children}
    </h2>
  );
}
