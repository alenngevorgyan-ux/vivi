/**
 * Visual handshake: the read-only hooks a presentation layer consumes.
 *
 * A pure projection of (manifest, snapshot, host settings), in the spirit of
 * `readable.ts`. It is NOT a second state machine: it owns no state, decides
 * nothing and cannot change a receipt. Design subscribes to this shape and
 * requests change only by dispatching the ordinary controller events
 * (OPEN_OBSERVATION, REQUEST_PORTAL, REQUEST_INTENT, CONFIRM, ENACTED,
 * HOLD_DONE, SKIP, …) through the InputManager-owned shell.
 *
 * Deliberately absent: pigment, masks, poses, asset paths, CSS, and anything
 * from the private author record. Before the boundary it carries no reveal
 * text; after it, only the reveal status — the record itself travels on the
 * host's `load_reveal` path, never through here.
 */

import type { EntityState, PlaybackManifestV3, SpatialMark } from '../../../engine/v3/contracts/manifest.ts';
import type { EntityRef, FactId, ObservationPlan, ScenePlan } from '../../../engine/v3/contracts/semantic.ts';
import type { Phase, RuntimeSnapshot } from '../../../engine/v3/contracts/state.ts';
import { isPaused } from '../../../engine/v3/ClockService.ts';
import { currentScene, entityLocation, nextBeat, portalBlock, scenePortals } from '../../../engine/v3/queries.ts';

/** Host-owned settings; not story state, so they are not in the snapshot. */
export interface PresentationSettings {
  reducedMotion: boolean;
  highContrast: boolean;
  /** `unavailable` until the host has an audio path at all. */
  audio: { unlocked: boolean; muted: boolean } | 'unavailable';
}

export interface EntityHook {
  id: string;
  kind: 'actor' | 'object';
  isHero: boolean;
  owner: EntityState['owner'];
  /** Resolved place (an object held by an actor is where the actor is); undefined offstage. */
  location?: string;
  /** In the current location. */
  inView: boolean;
  /** Not here, but visible through this currently open door: projection only, never a transfer. */
  visibleThrough?: string;
  heldBy?: string;
  mark?: SpatialMark;
  /** Semantic mark role (e.g. a reversible reposition); Design maps it to the scene's named mark. */
  markRole?: string;
}

export interface VisualHooksV3 {
  revisions: { experienceId: string; manifestRevision: string; decisionVersion: string; attemptId: string; locale: string; assetRevisions: Record<string, string> };
  phase: Phase;
  scene: Pick<ScenePlan, 'id' | 'location' | 'kind' | 'viewpoint' | 'purpose' | 'composition'> & {
    kitRevision: string;
    compositionRevision: string;
    cameraRecipe: string;
    lightRecipe: string;
    audioRecipe: string;
    entryMark?: SpatialMark;
    marks: Record<string, SpatialMark>;
  };
  /** Layer lifecycle: mount on `entering`, dispose the source after the swap. */
  transition: { state: 'idle' | 'preloading' | 'entering'; txId?: string; portal?: string; fromScene?: string; toScene?: string; fromLocation?: string; toLocation?: string };
  actors: EntityHook[];
  objects: EntityHook[];
  knowledge: { receivedFacts: FactId[]; deliveredBeats: string[]; readerCanAdvance: boolean };
  attention: { selectedTarget?: EntityRef; observation?: Pick<ObservationPlan, 'id' | 'target' | 'facts' | 'presentation'> };
  doors: Array<{ id: string; kind: 'spine' | 'excursion'; label: string; available: boolean; state?: string }>;
  opportunity: { selected?: string; pendingConfirmation: boolean };
  commitment?: { decisionId: string; option: string; status: 'accepted' | 'recorded'; enactment: 'enacting' | 'holding' | 'done' };
  boundary: { locked: boolean; reached: boolean };
  reveal: { phase: RuntimeSnapshot['reveal'] };
  /** False while hidden/blurred/user-paused: stop sampling, settle, never catch up. */
  presentationEligible: boolean;
  pauses: string[];
  settings: PresentationSettings;
}

const BOUNDARY_REACHED: readonly Phase[] = ['boundary', 'reveal_loading', 'revealed', 'ended'];

export function projectVisualHooks(m: PlaybackManifestV3, s: RuntimeSnapshot, settings: PresentationSettings): VisualHooksV3 {
  const plan = currentScene(m, s);
  const compiled = m.compiledScenes.find(c => c.id === plan.id)!;
  // A door whose receipt says it is open lets the hero see the room beyond it.
  const openDoors = scenePortals(m, s).filter(p => p.kind === 'excursion' && s.variables[`portal_${p.id}`] === 'open');

  const hook = (e: EntityState): EntityHook => {
    const location = entityLocation(s, e.id);
    const through = location && location !== s.location ? openDoors.find(p => p.to === location)?.id : undefined;
    return {
      id: e.id,
      kind: e.kind,
      isHero: e.id === m.perspectiveActor,
      owner: { ...e.owner },
      location,
      inView: location === s.location,
      ...(through ? { visibleThrough: through } : {}),
      ...(e.owner.kind === 'actor' ? { heldBy: e.owner.id } : {}),
      ...(e.mark ? { mark: { ...e.mark } } : {}),
      ...(e.state.mark_role ? { markRole: e.state.mark_role } : {}),
    };
  };

  const obs = s.openObservation ? m.observations.find(o => o.id === s.openObservation) : undefined;
  const enactment = s.phase === 'enacting' ? 'enacting' : s.phase === 'holding' ? 'holding' : 'done';

  return {
    revisions: { experienceId: m.experienceId, manifestRevision: s.manifestRevision, decisionVersion: s.decisionVersion, attemptId: s.attemptId, locale: m.locale, assetRevisions: { ...m.assetRevisions } },
    phase: s.phase,
    scene: {
      id: plan.id,
      location: plan.location,
      kind: plan.kind,
      viewpoint: plan.viewpoint,
      purpose: plan.purpose,
      composition: plan.composition,
      kitRevision: compiled.kitRevision,
      compositionRevision: compiled.compositionRevision,
      cameraRecipe: compiled.cameraRecipe,
      lightRecipe: compiled.lightRecipe,
      audioRecipe: compiled.audioRecipe,
      ...(compiled.entryMark ? { entryMark: { ...compiled.entryMark } } : {}),
      marks: structuredClone(compiled.marks ?? {}),
    },
    transition: s.transition
      ? { state: 'preloading', txId: s.transition.id, portal: s.transition.portal, fromScene: s.transition.fromScene, toScene: s.transition.toScene, fromLocation: s.transition.fromLocation, toLocation: s.transition.toLocation }
      : { state: s.phase === 'entering' ? 'entering' : 'idle' },
    actors: s.entities.filter(e => e.kind === 'actor').map(hook),
    objects: s.entities.filter(e => e.kind === 'object').map(hook),
    knowledge: { receivedFacts: [...s.receivedFacts], deliveredBeats: [...s.deliveredBeats], readerCanAdvance: !s.boundaryLocked && !!nextBeat(m, s) },
    attention: {
      ...(s.selectedTarget ? { selectedTarget: { ...s.selectedTarget } } : {}),
      ...(obs ? { observation: { id: obs.id, target: { ...obs.target }, facts: [...obs.facts], presentation: obs.presentation } } : {}),
    },
    doors: scenePortals(m, s).map(p => ({ id: p.id, kind: p.kind, label: p.label, available: !portalBlock(m, s, p), ...(s.variables[`portal_${p.id}`] ? { state: s.variables[`portal_${p.id}`] } : {}) })),
    opportunity: { ...(s.reservation ? { selected: s.reservation.option } : {}), pendingConfirmation: s.phase === 'confirming' },
    ...(s.decision ? { commitment: { decisionId: s.decision.id, option: s.decision.option, status: s.decision.status, enactment } } : {}),
    boundary: { locked: s.boundaryLocked, reached: BOUNDARY_REACHED.includes(s.phase) },
    reveal: { phase: s.reveal },
    presentationEligible: !(isPaused(s.time, 'hidden') || isPaused(s.time, 'blur') || isPaused(s.time, 'user')),
    pauses: [...s.time.pauses],
    settings: structuredClone(settings),
  };
}
