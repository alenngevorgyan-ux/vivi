/**
 * The experience, as a pure state machine.
 *
 *   orienting ─▶ exploring ⇄ approaching ─▶ observing ─▶ exploring
 *                    │  (select a deed: pending, still cancellable)
 *                    ▼
 *                 COMMIT ─▶ enacting ─▶ pausing ─▶ boundary ─▶ revealed
 *
 * Looking never commits. A deed commits only on an explicit COMMIT, exactly
 * once; after that every other deed is closed, nothing can be cancelled, and
 * the reveal cannot begin until the deed has been performed or the player has
 * skipped its performance. The machine emits effects instead of performing
 * them, so persistence and telemetry are testable without a browser.
 */

export type Phase = 'orienting' | 'exploring' | 'approaching' | 'observing' | 'enacting' | 'pausing' | 'boundary' | 'revealed';

export interface ExperienceState {
  phase: Phase;
  /** Target under keyboard focus (Tab) or hover; purely presentational. */
  focusId?: string;
  /** An observation being walked to or shown. */
  observationId?: string;
  /** A deed the player has picked but not yet confirmed. */
  pendingId?: string;
  /** The deed, once committed. Never changes afterwards. */
  committedId?: string;
  seen: string[];
  /** Increments on each restart; a replay is not a first choice. */
  run: number;
}

export type ExperienceEvent =
  | { type: 'ORIENTED' }
  | { type: 'FOCUS'; id?: string }
  | { type: 'LOOK'; id: string }
  | { type: 'ARRIVED'; id: string }
  | { type: 'CLOSE_OBSERVATION' }
  | { type: 'PICK'; id: string }
  | { type: 'CANCEL' }
  | { type: 'COMMIT'; id: string }
  | { type: 'ENACTED' }
  | { type: 'PAUSED' }
  | { type: 'BOUNDARY_DONE' }
  | { type: 'SKIP' }
  | { type: 'RESTART' };

export type ExperienceEffect =
  | { type: 'approach'; id: string }
  | { type: 'stop_approach' }
  | { type: 'persist_choice'; id: string; run: number }
  | { type: 'enact'; id: string }
  | { type: 'telemetry'; name: string; id?: string };

export interface Transition {
  state: ExperienceState;
  effects: ExperienceEffect[];
}

export const initialExperienceState = (run = 0): ExperienceState => ({ phase: 'orienting', seen: [], run });

const BEFORE_COMMIT: Phase[] = ['exploring', 'approaching', 'observing'];

export function step(state: ExperienceState, event: ExperienceEvent): Transition {
  const same = { state, effects: [] as ExperienceEffect[] };
  const open = BEFORE_COMMIT.includes(state.phase);

  switch (event.type) {
    case 'ORIENTED':
      return state.phase === 'orienting' ? { state: { ...state, phase: 'exploring' }, effects: [{ type: 'telemetry', name: 'experience_oriented' }] } : same;

    case 'FOCUS':
      return open || state.phase === 'orienting' ? { state: { ...state, focusId: event.id }, effects: [] } : same;

    case 'LOOK':
      if (!open) return same;
      return {
        state: { ...state, phase: 'approaching', observationId: event.id, pendingId: undefined },
        effects: [
          ...(state.phase === 'approaching' ? [{ type: 'stop_approach' } as const] : []),
          { type: 'approach', id: event.id },
          { type: 'telemetry', name: 'intent_selected', id: event.id },
        ],
      };

    case 'ARRIVED':
      if (state.phase !== 'approaching' || state.observationId !== event.id) return same;
      return {
        state: { ...state, phase: 'observing', seen: state.seen.includes(event.id) ? state.seen : [...state.seen, event.id] },
        effects: [{ type: 'telemetry', name: 'observation_opened', id: event.id }],
      };

    case 'CLOSE_OBSERVATION':
      return state.phase === 'observing' ? { state: { ...state, phase: 'exploring', observationId: undefined }, effects: [] } : same;

    case 'PICK':
      if (!open) return same;
      return {
        state: { ...state, phase: 'exploring', observationId: undefined, pendingId: event.id },
        effects: [
          ...(state.phase === 'approaching' ? [{ type: 'stop_approach' } as const] : []),
          { type: 'telemetry', name: 'intent_selected', id: event.id },
        ],
      };

    case 'CANCEL':
      if (!open) return same; // after a commitment there is nothing to take back
      return {
        state: { ...state, phase: 'exploring', observationId: undefined, pendingId: undefined },
        effects: state.phase === 'approaching' ? [{ type: 'stop_approach' }] : [],
      };

    case 'COMMIT':
      if (!open || state.committedId) return same;
      return {
        state: { ...state, phase: 'enacting', committedId: event.id, pendingId: undefined, observationId: undefined },
        effects: [
          ...(state.phase === 'approaching' ? [{ type: 'stop_approach' } as const] : []),
          { type: 'persist_choice', id: event.id, run: state.run },
          { type: 'telemetry', name: 'commitment_locked', id: event.id },
          { type: 'enact', id: event.id },
        ],
      };

    case 'ENACTED':
      return state.phase === 'enacting'
        ? { state: { ...state, phase: 'pausing' }, effects: [{ type: 'telemetry', name: 'enactment_completed', id: state.committedId }] }
        : same;

    case 'PAUSED':
      return state.phase === 'pausing' ? { state: { ...state, phase: 'boundary' }, effects: [] } : same;

    case 'BOUNDARY_DONE':
      return state.phase === 'boundary'
        ? { state: { ...state, phase: 'revealed' }, effects: [{ type: 'telemetry', name: 'reveal_viewed', id: state.committedId }] }
        : same;

    case 'SKIP':
      // A deliberate skip of the performance is a correct end to it; nothing before a commitment can be skipped into a reveal.
      if (state.phase === 'orienting') return { state: { ...state, phase: 'exploring' }, effects: [{ type: 'telemetry', name: 'orientation_skipped' }] };
      if (state.phase === 'enacting' || state.phase === 'pausing' || state.phase === 'boundary') {
        return {
          state: { ...state, phase: 'revealed' },
          effects: [
            ...(state.phase === 'enacting' ? [{ type: 'telemetry', name: 'enactment_skipped', id: state.committedId } as const] : []),
            { type: 'telemetry', name: 'reveal_viewed', id: state.committedId },
          ],
        };
      }
      return same;

    case 'RESTART':
      return { state: initialExperienceState(state.run + 1), effects: [{ type: 'telemetry', name: 'experience_started' }] };
  }
}

/** Fold a sequence of events; handy for tests and for replaying a session log. */
export function run(events: ExperienceEvent[], from: ExperienceState = initialExperienceState()): Transition {
  let state = from;
  const effects: ExperienceEffect[] = [];
  for (const e of events) {
    const t = step(state, e);
    state = t.state;
    effects.push(...t.effects);
  }
  return { state, effects };
}
