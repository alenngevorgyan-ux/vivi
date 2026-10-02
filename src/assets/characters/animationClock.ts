import { useEffect, useState } from 'react';

type Subscriber = (tMs: number) => void;

const subscribers = new Set<Subscriber>();
let rafId: number | null = null;
let originMs = 0;

function frame(now: number) {
  if (originMs === 0) originMs = now;
  const t = now - originMs;
  for (const fn of subscribers) fn(t);
  rafId = subscribers.size > 0 ? requestAnimationFrame(frame) : null;
}

function subscribe(fn: Subscriber) {
  subscribers.add(fn);
  if (rafId === null) rafId = requestAnimationFrame(frame);
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * One shared requestAnimationFrame clock for every animated figure on stage.
 *
 * Returns 0 during server rendering and under reduced motion, so the character
 * sheet generator and motion-sensitive viewers both get a clean static pose.
 */
export function useViviClock(enabled = true): number {
  const [tMs, setTMs] = useState(0);

  useEffect(() => {
    if (!enabled || prefersReducedMotion()) return;
    return subscribe(setTMs);
  }, [enabled]);

  return tMs;
}
