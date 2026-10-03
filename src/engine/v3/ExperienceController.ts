/**
 * The V3 experience as a pure reducer.
 *
 *   loading ─▶ entering ─▶ playing ⇄ transitioning ─▶ entering ─▶ playing
 *                            │  (observation, sheet, modal and selection are
 *                            │   interaction sub-state of `playing`, never
 *                            │   phases of their own)
 *                            └─ REQUEST_INTENT ─▶ confirming
 *                                  ├─ CANCEL ─▶ playing
 *                                  └─ CONFIRM ─▶ enacting ─▶ holding ─▶ boundary
 *                                                   ─▶ reveal_loading ─▶ revealed ─▶ ended
 *
 * The UI is never the source of causal truth: it sends events and renders the
 * snapshot. The reducer performs no side effects; it returns effect requests.
 * It runs in Node with no React and no DOM.
 *
 * Rules enforced here, not in components:
 *  - one physical activation is spent on at most one state change, so a held
 *    key or a double click cannot open, select and confirm in one gesture;
 *  - the decision is recorded once; duplicates are no-ops, never a new choice;
 *  - after the primary act is accepted the world is locked: only presentation
 *    and reveal progress remain possible.
 */

import type { EntityRef, FactId } from './contracts/semantic.ts';
import type { PlaybackManifestV3 } from './contracts/manifest.ts';
import { SNAPSHOT_VERSION } from './contracts/manifest.ts';
import type { EntityState } from './contracts/manifest.ts';
import type { PreparationRecord, RuntimeSnapshot } from './contracts/state.ts';
import { initialClock, pause, resume, tick, type PauseReason } from './ClockService.ts';
import { abortTransition, beginTransition, commitTransition } from './TransitionController.ts';
import {
  currentScene,
  entityLocation,
  entityOf,
  evaluateGate,
  movementEligible as movementEligibleFor,
  nextBeat,
  observationAvailable,
  opportunityBlock,
  preparationApplied,
  preparationAvailable,
  targetActions,
  targetExists,
} from './queries.ts';
import type { ControllerEffect, RejectionCode, StepResult } from './types.ts';

export type { ControllerEffect, RejectionCode, StepResult } from './types.ts';
export const movementEligible = movementEligibleFor;

export type ExperienceEvent =
  | { type: 'LOADED' }
  | { type: 'ENTERED' }
  | { type: 'TICK'; dtMs: number }
  | { type: 'PAUSE'; reason: PauseReason; owner?: string }
  | { type: 'RESUME'; reason: PauseReason; owner?: string }
  | { type: 'SELECT_TARGET'; target: EntityRef; activationId?: string }
  | { type: 'CLEAR_TARGET' }
  /** Enter in the world. Opens something; never commits anything. */
  | { type: 'ACTIVATE_CONTEXT'; activationId: string }
  | { type: 'OPEN_ACTIONS'; activationId?: string }
  | { type: 'CLOSE_SHEET' }
  | { type: 'OPEN_OBSERVATION'; id: string; activationId?: string }
  | { type: 'CLOSE_OBSERVATION' }
  | { type: 'OPEN_MODAL'; id: string }
  | { type: 'CLOSE_MODAL' }
  | { type: 'ADVANCE'; activationId?: string }
  | { type: 'APPLY_PREPARATION'; id: string; activationId?: string }
  | { type: 'REVERT_PREPARATION'; id: string; activationId?: string }
  | { type: 'REQUEST_PORTAL'; id: string; activationId?: string }
  | { type: 'TRANSITION_READY'; txId: string }
  | { type: 'TRANSITION_FAILED'; txId: string }
  | { type: 'REQUEST_INTENT'; id: string; activationId: string }
  | { type: 'CANCEL' }
  | { type: 'CONFIRM'; id: string; activationId: string }
  | { type: 'DECISION_RECORDED' }
  | { type: 'ENACTED' }
  | { type: 'HOLD_DONE' }
  | { type: 'SKIP' }
  | { type: 'REACH_BOUNDARY' }
  | { type: 'BOUNDARY_DONE' }
  | { type: 'REVEAL_LOADED' }
  | { type: 'REVEAL_FAILED' }
  | { type: 'RETRY_REVEAL' }
  | { type: 'END' };

/** What may still happen once the primary act is accepted: presentation and reveal progress only. */
const AFTER_BOUNDARY = new Set<ExperienceEvent['type']>([
  'TICK', 'PAUSE', 'RESUME', 'OPEN_MODAL', 'CLOSE_MODAL', 'DECISION_RECORDED', 'ENACTED', 'HOLD_DONE', 'SKIP', 'BOUNDARY_DONE', 'REVEAL_LOADED', 'REVEAL_FAILED', 'RETRY_REVEAL', 'END',
]);

const MAX_ACTIVATIONS = 32;

export function createExperience(m: PlaybackManifestV3, opts: { attemptId: string }): RuntimeSnapshot {
  const first = m.spine[0];
  const scene = m.scenePlans.find(s => s.id === first)!;
  return {
    snapshotVersion: SNAPSHOT_VERSION,
    attemptId: opts.attemptId,
    manifestRevision: m.revision,
    decisionVersion: m.decisionVersion,
    phase: 'loading',
    scene: scene.id,
    location: scene.location,
    arcIndex: 0,
    visitedScenes: [scene.id],
    deliveredBeats: [],
    receivedFacts: [],
    seenObservations: [],
    consumedEvents: [],
    entities: structuredClone(m.initialEntities),
    variables: {},
    preparations: [],
    time: initialClock('soft'),
    boundaryLocked: false,
    reveal: 'idle',
    txCounter: 0,
    consumedActivations: [],
  };
}

const rejectWith = (state: RuntimeSnapshot, code: RejectionCode, event: string): StepResult => ({
  state,
  effects: [{ type: 'diagnostic', code, event }],
  rejected: { code },
});
const ok = (state: RuntimeSnapshot, effects: ControllerEffect[] = []): StepResult => ({ state, effects });
const addUnique = <T,>(xs: T[], items: T[]) => {
  const out = xs.slice();
  for (const i of items) if (!out.includes(i)) out.push(i);
  return out;
};

export function step(m: PlaybackManifestV3, s: RuntimeSnapshot, e: ExperienceEvent): StepResult {
  // Events come from UI code and tests; a malformed one is refused, never allowed to throw inside the reducer.
  if (!e || typeof e !== 'object' || typeof e.type !== 'string') return rejectWith(s, 'invalid_event', 'unknown');
  const rej = (code: RejectionCode) => rejectWith(s, code, e.type);

  /* decisions are idempotent: a repeat of the accepted act is a no-op, anything else is closed */
  if (s.decision && (e.type === 'CONFIRM' || e.type === 'REQUEST_INTENT')) return rej(e.id === s.decision.option ? 'duplicate_decision' : 'decision_closed');

  /* after the primary act the world accepts no causal change */
  if (s.boundaryLocked && !AFTER_BOUNDARY.has(e.type)) {
    if (e.type === 'CANCEL' && s.modal) return closeModal(s);
    return rej('locked');
  }

  /* one physical activation, at most one state change */
  const act = 'activationId' in e ? e.activationId : undefined;
  if (act !== undefined && (typeof act !== 'string' || act === '')) return rej('invalid_event');
  if (act !== undefined && s.consumedActivations.includes(act)) return rej('duplicate_activation');

  const r = apply(m, s, e);
  if (r.rejected || act === undefined) return r;
  return { ...r, state: { ...r.state, consumedActivations: [...r.state.consumedActivations, act].slice(-MAX_ACTIVATIONS) } };
}

function closeModal(s: RuntimeSnapshot): StepResult {
  if (!s.modal) return rejectWith(s, 'nothing_to_cancel', 'CLOSE_MODAL');
  return ok({ ...s, modal: undefined, time: resume(s.time, 'modal', `modal:${s.modal}`) });
}

function apply(m: PlaybackManifestV3, s: RuntimeSnapshot, e: ExperienceEvent): StepResult {
  const rej = (code: RejectionCode) => rejectWith(s, code, e.type);
  const playing = s.phase === 'playing';
  const free = playing && !s.openObservation && !s.modal; // nothing blocks starting something new

  switch (e.type) {
    /* ------------------------------------------------------ lifecycle -- */
    case 'LOADED':
      return s.phase === 'loading' ? ok({ ...s, phase: 'entering' }, [{ type: 'save_snapshot' }]) : rej('wrong_phase');
    case 'ENTERED':
      return s.phase === 'entering' ? ok({ ...s, phase: 'playing' }) : rej('wrong_phase');

    /* ----------------------------------------------------------- clock -- */
    case 'TICK':
      return ok({ ...s, time: tick(s.time, e.dtMs) });
    case 'PAUSE':
      return ok({ ...s, time: pause(s.time, e.reason, e.owner) });
    case 'RESUME':
      return ok({ ...s, time: resume(s.time, e.reason, e.owner) });

    /* ------------------------------------------------------- selection -- */
    case 'SELECT_TARGET':
      if (!e.target || typeof e.target !== 'object' || typeof e.target.kind !== 'string') return rej('invalid_event');
      if (!playing || s.reservation) return rej('wrong_phase');
      if (s.openObservation || s.modal || s.sheet) return rej('busy');
      if (!targetExists(m, e.target)) return rej('unknown_id');
      return ok({ ...s, selectedTarget: e.target });
    case 'CLEAR_TARGET':
      return s.selectedTarget ? ok({ ...s, selectedTarget: undefined }) : rej('nothing_to_cancel');

    /* -------------------------------------------- the contextual action -- */
    case 'ACTIVATE_CONTEXT': {
      if (!playing) return rej('wrong_phase');
      if (s.openObservation || s.modal || s.sheet) return rej('busy');
      if (s.selectedTarget) {
        const t = targetActions(m, s, s.selectedTarget);
        const total = t.observations.length + t.preparations.length + t.portals.length + t.opportunities.length;
        // A target with exactly one observation and nothing else opens it directly. Anything else lists its actions.
        if (total === 1 && t.observations.length === 1) return openObservation(m, s, t.observations[0].id);
        if (total > 0) return ok(openSheet(s, { kind: 'target', target: s.selectedTarget, openedBy: e.activationId }));
      }
      return ok(openSheet(s, { kind: 'actions', openedBy: e.activationId }));
    }
    case 'OPEN_ACTIONS':
      if (!playing) return rej('wrong_phase');
      if (s.openObservation || s.modal || s.sheet) return rej('busy');
      return ok(openSheet(s, { kind: 'actions', openedBy: e.activationId ?? 'programmatic' }));
    case 'CLOSE_SHEET':
      return playing && s.sheet ? ok(closeSheet(s)) : rej('nothing_to_cancel');

    /* ----------------------------------------------------- observation -- */
    case 'OPEN_OBSERVATION':
      if (!playing) return rej('wrong_phase');
      if (s.openObservation || s.modal) return rej('busy');
      return openObservation(m, s, e.id);
    case 'CLOSE_OBSERVATION':
      return s.openObservation ? ok({ ...s, openObservation: undefined, time: resume(s.time, 'reading', s.openObservation) }) : rej('nothing_to_cancel');

    /* ------------------------------------------------------------ modal -- */
    case 'OPEN_MODAL':
      if (s.phase === 'loading') return rej('wrong_phase');
      if (s.modal) return rej('busy');
      return ok({ ...s, modal: e.id, time: pause(s.time, 'modal', `modal:${e.id}`) });
    case 'CLOSE_MODAL':
      return closeModal(s);

    /* ----------------------------------------------------------- beats -- */
    case 'ADVANCE': {
      if (!free || s.sheet) return rej(playing ? 'busy' : 'wrong_phase');
      const beat = nextBeat(m, s);
      if (!beat) return rej('nothing_to_advance');
      return ok(deliverBeat(m, s, beat.id), [{ type: 'save_snapshot' }]);
    }

    /* ---------------------------------------------------- preparations -- */
    case 'APPLY_PREPARATION': {
      if (!free) return rej(playing ? 'busy' : 'wrong_phase');
      const prep = m.preparations.find(p => p.id === e.id);
      if (!prep) return rej('unknown_id');
      if (preparationApplied(s, prep.id)) return rej('already_applied');
      if (!preparationAvailable(s, prep)) return rej('unavailable');
      const r = applyPreparation(m, s, prep.id);
      return r ? ok(r) : rej('unavailable');
    }
    case 'REVERT_PREPARATION': {
      if (!free) return rej(playing ? 'busy' : 'wrong_phase');
      const rec = s.preparations.find(p => p.id === e.id);
      if (!rec) return rej('not_applied');
      return ok(revertPreparation(s, rec));
    }

    /* ----------------------------------------------------------- portals - */
    case 'REQUEST_PORTAL':
      return beginTransition(m, s, e.id);
    case 'TRANSITION_READY':
      return commitTransition(m, s, e.txId);
    case 'TRANSITION_FAILED':
      return abortTransition(s, e.txId);

    /* -------------------------------------------------- the primary act -- */
    case 'REQUEST_INTENT': {
      if (!playing) return rej('wrong_phase');
      if (s.openObservation || s.modal) return rej('busy');
      const o = m.opportunities.find(x => x.id === e.id);
      if (!o) return rej('unknown_id');
      const block = opportunityBlock(m, s, o);
      if (block) return rej(block === 'knowledge_missing' ? 'knowledge_missing' : block === 'wrong_scene' ? 'wrong_scene' : 'unavailable');
      // The sheet that offered the act becomes the confirmation surface.
      const base = closeSheet(s);
      return ok({ ...base, phase: 'confirming', reservation: { option: o.id, openedBy: e.activationId }, time: pause(base.time, 'modal', 'confirm') });
    }
    case 'CANCEL': {
      if (s.modal) return closeModal(s);
      if (s.phase === 'confirming') return ok({ ...s, phase: 'playing', reservation: undefined, time: resume(s.time, 'modal', 'confirm') });
      if (s.openObservation) return ok({ ...s, openObservation: undefined, time: resume(s.time, 'reading', s.openObservation) });
      if (s.sheet) return ok(closeSheet(s));
      if (s.selectedTarget) return ok({ ...s, selectedTarget: undefined });
      return rej('nothing_to_cancel');
    }
    case 'CONFIRM': {
      const res = s.reservation;
      if (s.phase !== 'confirming' || !res || res.option !== e.id) return rej('stale_confirmation');
      if (e.activationId === res.openedBy) return rej('duplicate_activation'); // the gesture that opened it cannot confirm it
      const o = m.opportunities.find(x => x.id === e.id);
      const d = m.primaryDecision;
      if (!o || !d) return rej('unknown_id');
      // Recheck at the moment of acceptance: the reservation does not bypass eligibility.
      const stillOk = s.scene === d.scene && d.minimumKnowledge.every(f => s.receivedFacts.includes(f)) && evaluateGate(o.available, s);
      if (!stillOk) return rej('unavailable');
      return ok(
        {
          ...s,
          phase: 'enacting',
          decision: { id: d.id, option: o.id, status: 'accepted' },
          reservation: undefined,
          sheet: undefined,
          openObservation: undefined,
          selectedTarget: undefined,
          boundaryLocked: true,
          time: resume(s.time, 'modal', 'confirm'),
        },
        [{ type: 'persist_decision', decision: d.id, option: o.id }, { type: 'enact', option: o.id }, { type: 'save_snapshot' }]
      );
    }
    case 'DECISION_RECORDED':
      return s.decision ? ok({ ...s, decision: { ...s.decision, status: 'recorded' } }) : rej('wrong_phase');

    /* ------------------------------------------- enactment to the reveal -- */
    case 'ENACTED':
      return s.phase === 'enacting' ? ok({ ...s, phase: 'holding' }) : rej('wrong_phase');
    case 'HOLD_DONE':
      return s.phase === 'holding' ? ok({ ...s, phase: 'boundary' }) : rej('wrong_phase');
    case 'SKIP':
      // Skipping fast-forwards presentation of an accepted act. It can never create one.
      if (!s.decision) return rej('skip_before_commit');
      return s.phase === 'enacting' || s.phase === 'holding' ? ok({ ...s, phase: 'boundary' }) : rej('wrong_phase');
    case 'REACH_BOUNDARY':
      // The memory form: no decision exists, the boundary is the end of the account's pre-reveal part.
      if (!playing || m.primaryDecision !== null || m.truthBoundary.after !== 'memory_end') return rej('wrong_phase');
      if (s.openObservation || s.modal || s.sheet) return rej('busy');
      return ok({ ...s, phase: 'boundary', boundaryLocked: true, selectedTarget: undefined }, [{ type: 'save_snapshot' }]);
    case 'BOUNDARY_DONE':
      return s.phase === 'boundary' ? ok({ ...s, phase: 'reveal_loading', reveal: 'loading' }, [{ type: 'load_reveal', experienceId: m.experienceId, revision: m.revision }]) : rej('wrong_phase');
    case 'REVEAL_LOADED':
      return s.phase === 'reveal_loading' ? ok({ ...s, phase: 'revealed', reveal: 'ready' }) : rej('wrong_phase');
    case 'REVEAL_FAILED':
      // The accepted act stays accepted; the reveal can be retried without a second choice.
      return s.phase === 'reveal_loading' ? ok({ ...s, reveal: 'failed' }) : rej('wrong_phase');
    case 'RETRY_REVEAL':
      return s.phase === 'reveal_loading' && s.reveal === 'failed'
        ? ok({ ...s, reveal: 'loading' }, [{ type: 'load_reveal', experienceId: m.experienceId, revision: m.revision }])
        : rej('wrong_phase');
    case 'END':
      return s.phase === 'revealed' ? ok({ ...s, phase: 'ended' }) : rej('wrong_phase');
    default:
      return rej('invalid_event');
  }
}

/* ------------------------------------------------------------ helpers --- */

function openSheet(s: RuntimeSnapshot, sheet: NonNullable<RuntimeSnapshot['sheet']>): RuntimeSnapshot {
  return { ...s, sheet, time: pause(s.time, 'modal', 'sheet') };
}
function closeSheet(s: RuntimeSnapshot): RuntimeSnapshot {
  return s.sheet ? { ...s, sheet: undefined, time: resume(s.time, 'modal', 'sheet') } : s;
}

function openObservation(m: PlaybackManifestV3, s: RuntimeSnapshot, id: string): StepResult {
  const o = m.observations.find(x => x.id === id);
  if (!o) return rejectWith(s, 'unknown_id', 'OPEN_OBSERVATION');
  if (!observationAvailable(m, s, o)) return rejectWith(s, 'unavailable', 'OPEN_OBSERVATION');
  const base = closeSheet(s);
  return ok({
    ...base,
    openObservation: o.id,
    // Facts are received as they are shown; re-opening adds nothing twice.
    receivedFacts: addUnique<FactId>(base.receivedFacts, o.facts),
    seenObservations: addUnique(base.seenObservations, [o.id]),
    selectedTarget: undefined,
    time: pause(base.time, 'reading', o.id),
  });
}

/** Apply a beat's events once each. Soft-flow beats are delivered the same way: no timers exist yet. */
function deliverBeat(m: PlaybackManifestV3, s: RuntimeSnapshot, beatId: string): RuntimeSnapshot {
  const beat = currentScene(m, s).beats.find(b => b.id === beatId)!;
  let next: RuntimeSnapshot = { ...s, deliveredBeats: addUnique(s.deliveredBeats, [beat.id]) };
  beat.events.forEach((ev, i) => {
    const eventId = `${beat.id}:${i}`;
    if (next.consumedEvents.includes(eventId)) return;
    next = { ...next, consumedEvents: [...next.consumedEvents, eventId] };
    switch (ev.kind) {
      case 'deliver':
        next = { ...next, receivedFacts: addUnique(next.receivedFacts, ev.facts) };
        break;
      case 'quote':
      case 'device_cue':
        next = { ...next, receivedFacts: addUnique(next.receivedFacts, [ev.fact]) };
        break;
      case 'transfer':
        next = {
          ...next,
          receivedFacts: addUnique(next.receivedFacts, ev.facts),
          entities: next.entities.map(x => (x.id === ev.entity ? { ...x, owner: { kind: 'location' as const, id: ev.to } } : x)),
        };
        break;
      case 'portal_state':
        next = { ...next, receivedFacts: addUnique(next.receivedFacts, [ev.fact]), variables: { ...next.variables, [`portal_${ev.portal}`]: ev.state } };
        break;
      case 'hold':
        break;
    }
  });
  return next;
}

/** Reversible, closed recipes. They only ever touch the hero or the hero's own reach. */
function applyPreparation(m: PlaybackManifestV3, s: RuntimeSnapshot, id: string): RuntimeSnapshot | undefined {
  const prep = m.preparations.find(p => p.id === id)!;
  const hero = entityOf(s, m.perspectiveActor);
  if (!hero) return undefined;
  const a = prep.action;
  const undo: PreparationRecord['undo'] = [];
  let entities = s.entities;
  const patch = (eid: string, f: (x: EntityState) => EntityState) => (entities = entities.map(x => (x.id === eid ? f(x) : x)));

  if (a.kind === 'reposition') {
    // The hero stands in one place: a new position supersedes an active one and inherits its baseline,
    // so undoing either can never strand the hero on a mark that no active preparation explains.
    const active = s.preparations.find(r => r.undo.some(u => u.kind === 'state' && u.entity === hero.id && u.key === 'mark_role'));
    patch(hero.id, x => ({ ...x, state: { ...x.state, mark_role: a.markRole } }));
    if (active) return { ...s, entities, preparations: [...s.preparations.filter(r => r !== active), { id, undo: active.undo }] };
    undo.push({ kind: 'state', entity: hero.id, key: 'mark_role', value: hero.state.mark_role ?? null });
  } else {
    const obj = entityOf(s, a.object);
    if (!obj) return undefined;
    const heroLoc = entityLocation(s, hero.id);
    const heldByHero = obj.owner.kind === 'actor' && obj.owner.id === hero.id;
    if (a.kind === 'hold_own_object') {
      // Only something within the hero's own reach: lying in the hero's location, never another person's belonging.
      const reachable = heldByHero || (obj.owner.kind === 'location' && obj.owner.id === heroLoc);
      if (!reachable) return undefined;
      undo.push({ kind: 'owner', entity: obj.id, owner: obj.owner });
      patch(obj.id, x => ({ ...x, owner: { kind: 'actor' as const, id: hero.id } }));
    } else {
      if (!heldByHero || !heroLoc) return undefined;
      undo.push({ kind: 'owner', entity: obj.id, owner: obj.owner });
      patch(obj.id, x => ({ ...x, owner: { kind: 'location' as const, id: heroLoc } }));
    }
  }
  return { ...s, entities, preparations: [...s.preparations, { id, undo }] };
}

function revertPreparation(s: RuntimeSnapshot, rec: PreparationRecord): RuntimeSnapshot {
  let entities = s.entities;
  for (const u of [...rec.undo].reverse()) {
    entities = entities.map(x => {
      if (x.id !== u.entity) return x;
      if (u.kind === 'owner') return { ...x, owner: u.owner };
      const state = { ...x.state };
      if (u.value === null) delete state[u.key];
      else state[u.key] = u.value;
      return { ...x, state };
    });
  }
  return { ...s, entities, preparations: s.preparations.filter(p => p.id !== rec.id) };
}

/* ------------------------------------------------- ownership projection -- */

export type ScopeKind = 'modal' | 'intent_sheet' | 'observation' | 'transition';

/**
 * The input scopes the snapshot implies. The shell registers exactly these
 * with the InputManager, so ownership is derived from state, not from which
 * component happened to mount.
 */
export function deriveScopes(s: RuntimeSnapshot): ScopeKind[] {
  const out: ScopeKind[] = [];
  if (s.modal) out.push('modal');
  if (s.sheet || s.phase === 'confirming') out.push('intent_sheet');
  if (s.openObservation) out.push('observation');
  if (s.phase === 'transitioning' || s.phase === 'entering' || s.phase === 'enacting' || s.phase === 'holding') out.push('transition');
  return out;
}

/* ------------------------------------------------------------- resume --- */

/**
 * Validate a stored snapshot against the manifest and normalise in-flight
 * state. Returns undefined for anything corrupted or from another revision;
 * the caller then starts fresh. An accepted act stays accepted: resuming
 * after it goes to the boundary, never back to a choice.
 */
export function restoreSnapshot(m: PlaybackManifestV3, raw: unknown): RuntimeSnapshot | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const s = raw as RuntimeSnapshot;
  const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string');
  if (s.snapshotVersion !== SNAPSHOT_VERSION || s.manifestRevision !== m.revision || s.decisionVersion !== m.decisionVersion) return undefined;
  if (!m.scenePlans.some(p => p.id === s.scene) || currentScene(m, s).location !== s.location) return undefined;
  if (!Number.isInteger(s.arcIndex) || s.arcIndex < 0 || s.arcIndex >= m.spine.length) return undefined;
  if (![s.visitedScenes, s.deliveredBeats, s.receivedFacts, s.seenObservations, s.consumedEvents, s.consumedActivations].every(strs)) return undefined;
  if (!s.visitedScenes.every(id => m.scenePlans.some(p => p.id === id))) return undefined;
  if (!s.receivedFacts.every(id => m.facts.some(f => f.id === id))) return undefined;
  if (!Array.isArray(s.entities) || s.entities.length !== m.initialEntities.length || !m.initialEntities.every(e => s.entities.some(x => x.id === e.id && x.kind === e.kind))) return undefined;
  if (s.decision && !m.opportunities.some(o => o.id === s.decision!.option)) return undefined;
  // Everything the reducer later reads must have its contract shape: a stored snapshot is untrusted input.
  const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const beats = new Set(m.scenePlans.flatMap(p => p.beats.map(b => b.id)));
  const locations = new Set(m.scenePlans.map(p => p.location));
  const kindOf = new Map(m.initialEntities.map(e => [e.id, e.kind] as const));
  if (!s.deliveredBeats.every(id => beats.has(id)) || !s.seenObservations.every(id => m.observations.some(o => o.id === id))) return undefined;
  if (typeof s.attemptId !== 'string' || typeof s.boundaryLocked !== 'boolean' || !Number.isInteger(s.txCounter) || s.txCounter < 0) return undefined;
  if (!isRec(s.variables) || !Object.values(s.variables).every(v => typeof v === 'string')) return undefined;
  const t = s.time as unknown;
  if (!isRec(t) || !['presentationMs', 'narrativeMs', 'opportunityMs'].every(k => Number.isFinite(t[k])) || !['soft', 'untimed', 'timed'].includes(t.policy as string)) return undefined;
  // One owner per entity, and only owners that exist: no actor carried, no one in a place this manifest never shows.
  const ownerOk = (e: unknown): boolean => {
    if (!isRec(e) || !isRec(e.owner) || !isRec(e.state)) return false;
    const o = e.owner;
    if (o.kind === 'location') return locations.has(o.id as string);
    if (o.kind === 'actor') return e.kind === 'object' && kindOf.get(o.id as string) === 'actor';
    return o.kind === 'offstage' && o.id === 'offstage';
  };
  if (!s.entities.every(ownerOk)) return undefined;
  const hero = s.entities.find(e => e.id === m.perspectiveActor);
  if (!hero || hero.owner.kind !== 'location' || hero.owner.id !== s.location) return undefined;
  const prepOk = (r: unknown) => isRec(r) && m.preparations.some(p => p.id === r.id) && Array.isArray(r.undo) && r.undo.every(u => isRec(u) && kindOf.has(u.entity as string));
  if (!Array.isArray(s.preparations) || !s.preparations.every(prepOk)) return undefined;
  if (s.decision && (!m.primaryDecision || s.decision.id !== m.primaryDecision.id || !m.primaryDecision.options.includes(s.decision.option))) return undefined;

  const clean: RuntimeSnapshot = {
    ...s,
    selectedTarget: undefined,
    sheet: undefined,
    openObservation: undefined,
    modal: undefined,
    transition: undefined,
    reservation: undefined,
    time: { ...s.time, pauses: [] },
    // Activation ids belong to one page session (a new InputManager restarts at k1/p1). Nothing an old
    // activation could act twice on survives the reset above, so keeping them would only swallow fresh input.
    consumedActivations: [],
  };
  if (s.decision) return { ...clean, phase: s.phase === 'revealed' || s.phase === 'ended' ? s.phase : 'boundary', boundaryLocked: true, reveal: s.phase === 'revealed' || s.phase === 'ended' ? 'ready' : 'idle' };
  // The memory form has no decision: a completed reveal is still completed. It must not regress to the boundary.
  if (s.boundaryLocked && (s.phase === 'revealed' || s.phase === 'ended')) return { ...clean, phase: s.phase, reveal: 'ready' };
  if (s.boundaryLocked) return { ...clean, phase: 'boundary' };
  return { ...clean, phase: s.phase === 'loading' ? 'loading' : 'playing' };
}
