/**
 * Prototype-grade abuse protection for model-backed generation.
 *
 * In-memory, single-process: a sliding-window rate limit per client, at most
 * one in-flight generation per client, and a global cap on concurrent
 * generations. Enough to stop an unauthenticated client from fanning out
 * unbounded paid requests; a multi-instance deployment needs a shared store.
 */
export interface GuardOptions {
  /** Generations per client per window. */
  perClient?: number;
  windowMs?: number;
  /** Concurrent generations across all clients. */
  maxConcurrent?: number;
  now?: () => number;
}

export type GuardDecision =
  | { ok: true; release: () => void }
  | { ok: false; status: 429 | 503; reason: 'rate_limited' | 'client_busy' | 'server_busy'; retryAfterSec: number };

export function createGenerationGuard({ perClient = 8, windowMs = 60_000, maxConcurrent = 4, now = Date.now }: GuardOptions = {}) {
  const history = new Map<string, number[]>();
  const inFlight = new Set<string>();
  let active = 0;

  const acquire = (client: string): GuardDecision => {
    const t = now();
    const recent = (history.get(client) ?? []).filter(at => t - at < windowMs);
    if (recent.length >= perClient) {
      history.set(client, recent);
      return { ok: false, status: 429, reason: 'rate_limited', retryAfterSec: Math.ceil((windowMs - (t - recent[0])) / 1000) };
    }
    if (inFlight.has(client)) return { ok: false, status: 429, reason: 'client_busy', retryAfterSec: 2 };
    if (active >= maxConcurrent) return { ok: false, status: 503, reason: 'server_busy', retryAfterSec: 3 };

    recent.push(t);
    history.set(client, recent);
    inFlight.add(client);
    active++;
    let released = false;
    return {
      ok: true,
      release: () => {
        if (released) return;
        released = true;
        inFlight.delete(client);
        active--;
      },
    };
  };

  // Keep the map from growing without bound on a long-running prototype.
  const sweep = () => {
    const t = now();
    for (const [client, times] of history) if (!times.some(at => t - at < windowMs)) history.delete(client);
  };

  return { acquire, sweep, get active() { return active; } };
}

export const LIMITS = {
  storyChars: 1500,
  outcomeChars: 1500,
  authorChars: 60,
  genreChars: 40,
} as const;
