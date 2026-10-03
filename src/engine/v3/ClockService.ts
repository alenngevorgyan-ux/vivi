/**
 * Clock state and pause semantics only. There are no timers and no countdown
 * gameplay in this pass: opportunity time never advances under the `soft` or
 * `untimed` policies, and `timed` is unsupported by the validator.
 *
 * What this module does guarantee is the pause model: a pause is keyed
 * `reason:owner`, so
 *   - closing a modal cannot unpause a hidden tab (different reasons),
 *   - closing one of two nested modals leaves the other pause in force
 *     (different owners),
 *   - a duplicate pause or a resume that matches nothing is harmless.
 */

import type { ClockState, TimePolicy } from './contracts/state.ts';

export type PauseReason = 'reading' | 'modal' | 'hidden' | 'blur' | 'transition' | 'user';

export const initialClock = (policy: TimePolicy = 'soft'): ClockState => ({ presentationMs: 0, narrativeMs: 0, opportunityMs: 0, policy, pauses: [] });

const key = (reason: string, owner: string) => `${reason}:${owner}`;

export function pause(clock: ClockState, reason: PauseReason, owner: string = reason): ClockState {
  const k = key(reason, owner);
  return clock.pauses.includes(k) ? clock : { ...clock, pauses: [...clock.pauses, k] };
}

export function resume(clock: ClockState, reason: PauseReason, owner: string = reason): ClockState {
  const k = key(reason, owner);
  return clock.pauses.includes(k) ? { ...clock, pauses: clock.pauses.filter(p => p !== k) } : clock;
}

export const isPaused = (clock: ClockState, reason?: PauseReason): boolean =>
  reason ? clock.pauses.some(p => p.startsWith(`${reason}:`)) : clock.pauses.length > 0;

/**
 * Advance the domains by an ACTIVE-session delta supplied by the host.
 * Presentation continues under reading/modal/transition pauses (ambient staging
 * may breathe) but stops when the tab is hidden, blurred or paused by the user.
 * Narrative stops under any pause. Opportunity time only exists for the
 * `timed` policy, which is not supported yet, so it never advances.
 */
export function tick(clock: ClockState, dtMs: number): ClockState {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return clock;
  const dt = Math.min(dtMs, 1000);
  const stillFrame = isPaused(clock, 'hidden') || isPaused(clock, 'blur') || isPaused(clock, 'user');
  const presentationMs = stillFrame ? clock.presentationMs : clock.presentationMs + dt;
  const narrativeMs = isPaused(clock) ? clock.narrativeMs : clock.narrativeMs + dt;
  const opportunityMs = clock.policy === 'timed' && !isPaused(clock) ? clock.opportunityMs + dt : clock.opportunityMs;
  return { ...clock, presentationMs, narrativeMs, opportunityMs };
}
