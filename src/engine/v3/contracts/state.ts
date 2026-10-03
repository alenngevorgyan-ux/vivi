/**
 * V3 runtime state. One serializable snapshot is authoritative; the UI and
 * the renderer never own causal truth. Everything here is plain JSON: IDs and
 * marks, never DOM or per-frame data.
 */

import type { BeatId, DecisionId, EntityId, EntityRef, FactId, Id, LocationId, ObservationId, OpportunityId, PortalId, PreparationId, SceneId } from './semantic.ts';
import type { EntityState } from './manifest.ts';

export type Phase =
  | 'loading'
  | 'entering'
  | 'playing'
  /** A portal transaction is in flight (REQUEST → preload → atomic swap). */
  | 'transitioning'
  | 'confirming'
  | 'enacting'
  | 'holding'
  | 'boundary'
  | 'reveal_loading'
  | 'revealed'
  | 'ended';

/** Phases that occur after the primary act is accepted. */
export const POST_COMMIT_PHASES: readonly Phase[] = ['enacting', 'holding', 'boundary', 'reveal_loading', 'revealed', 'ended'];

export type TimePolicy = 'soft' | 'untimed' | 'timed';

/**
 * Three time domains (presentation, narrative, opportunity) plus a set of
 * pause owners. A pause is keyed `reason:owner` so two different holders of
 * the same reason, or two different reasons, can never unpause one another.
 */
export interface ClockState {
  presentationMs: number;
  narrativeMs: number;
  opportunityMs: number;
  policy: TimePolicy;
  pauses: string[];
}

export interface PreparationRecord {
  id: PreparationId;
  /** Prior values, restored in reverse order on revert. */
  undo: Array<
    | { kind: 'owner'; entity: EntityId; owner: EntityState['owner'] }
    | { kind: 'state'; entity: EntityId; key: Id; value: string | null }
  >;
}

export interface SheetState {
  kind: 'actions' | 'target';
  target?: EntityRef;
  /** The physical activation that opened it; it can never also select or confirm. */
  openedBy: string;
}

export interface TransitionTransaction {
  id: string;
  portal: PortalId;
  fromScene: SceneId;
  toScene: SceneId;
  fromLocation: LocationId;
  toLocation: LocationId;
  status: 'preloading';
}

export interface RuntimeSnapshot {
  snapshotVersion: 1;
  attemptId: Id;
  manifestRevision: Id;
  decisionVersion: Id;
  phase: Phase;
  scene: SceneId;
  location: LocationId;
  /** Furthest spine index reached. Excursions never move it; history is never rewound. */
  arcIndex: number;
  visitedScenes: SceneId[];
  deliveredBeats: BeatId[];
  receivedFacts: FactId[];
  seenObservations: ObservationId[];
  /** `beat:index` of every semantic event applied; each applies once. */
  consumedEvents: Id[];
  entities: EntityState[];
  variables: Record<Id, string>;
  preparations: PreparationRecord[];
  time: ClockState;
  decision?: { id: DecisionId; option: OpportunityId; status: 'accepted' | 'recorded' };
  /** An option reserved through confirmation. Cancelling releases it. */
  reservation?: { option: OpportunityId; openedBy: string };
  transition?: TransitionTransaction;
  /** Interaction sub-state of `playing` (never a copy of the phase). */
  selectedTarget?: EntityRef;
  sheet?: SheetState;
  openObservation?: ObservationId;
  modal?: Id;
  /** Set once the primary act is accepted: the world accepts no further causal change. */
  boundaryLocked: boolean;
  reveal: 'idle' | 'loading' | 'failed' | 'ready';
  /** Deterministic transaction ids. */
  txCounter: number;
  /** Physical activations already spent on a state change (bounded). */
  consumedActivations: string[];
}
