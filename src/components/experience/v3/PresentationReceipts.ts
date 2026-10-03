/**
 * Presentation receipts and the presentation clock.
 *
 * A receipt says "this exact phase is now on screen". It is sent through ExperienceHost's guarded methods with
 * the token for THIS mount/attempt/decision/phase, only after the final state has been committed to the DOM and
 * painted (two animation frames), and at most once per phase instance. A refused receipt is never retried blindly:
 * `hidden` waits for the page to be visible again; `stale`/`wrong_phase`/`detached` are dropped.
 *
 * The presentation clock advances only while the page is visible and presentation is eligible. It never
 * catches up after a pause and never touches narrative or opportunity time: it can only make a receipt possible.
 */

import { useEffect, useRef } from 'react';
import type { ExperienceHost } from './ExperienceHost';
import type { ReceiptResult } from './hostContracts';

/** Run `fn` after the current state has been painted. Returns a cancel function. */
export function afterPaint(fn: () => void): () => void {
  let a = 0;
  let b = 0;
  a = requestAnimationFrame(() => {
    b = requestAnimationFrame(fn);
  });
  return () => {
    cancelAnimationFrame(a);
    cancelAnimationFrame(b);
  };
}

export type ReceiptKind = 'enacted' | 'held' | 'boundaryPresented';
const PHASE: Record<ReceiptKind, 'enacting' | 'holding' | 'boundary'> = { enacted: 'enacting', held: 'holding', boundaryPresented: 'boundary' };

/**
 * Send one guarded receipt when `ready` becomes true while the snapshot is in the receipt's phase. `instance`
 * distinguishes phase instances (attempt + decision), so a remount or a new attempt gets its own single receipt.
 */
export function useReceipt(host: ExperienceHost, kind: ReceiptKind, ready: boolean, instance: string, onResult?: (r: ReceiptResult) => void): void {
  const sent = useRef<string | null>(null);
  const cb = useRef(onResult);
  cb.current = onResult;
  useEffect(() => {
    if (!ready || sent.current === instance) return;
    if (host.getState().phase !== PHASE[kind]) return;
    let cancelled = false;
    let cancelPaint = afterPaint(function attemptSend() {
      if (cancelled) return;
      const r = host[kind](host.receiptToken());
      if (r.ok) {
        sent.current = instance;
        cb.current?.(r);
        return;
      }
      cb.current?.(r);
      if (r.reason === 'hidden') {
        const onVisible = () => {
          if (document.visibilityState !== 'visible') return;
          document.removeEventListener('visibilitychange', onVisible);
          cancelPaint = afterPaint(attemptSend);
        };
        document.addEventListener('visibilitychange', onVisible);
      }
    });
    return () => {
      cancelled = true;
      cancelPaint();
    };
  }, [host, kind, ready, instance]);
}

/**
 * A presentation-time countdown: calls `onDone` once after `durationMs` of VISIBLE, eligible time. Frame deltas
 * are clamped, so a hidden tab or a long frame never fast-forwards it.
 */
export function usePresentationTimer(running: boolean, durationMs: number, onDone: () => void, key: string): void {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!running) return;
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    let fired = false;
    const tick = (now: number) => {
      const dt = Math.min(64, Math.max(0, now - last));
      last = now;
      if (document.visibilityState === 'visible') elapsed += dt;
      if (elapsed >= durationMs) {
        if (!fired) {
          fired = true;
          done.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const onVis = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [running, durationMs, key]);
}
