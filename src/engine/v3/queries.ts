/**
 * Pure read-side helpers over (manifest, snapshot). The controller, the
 * transition controller and the readable projection all answer availability
 * through here, so the pointer path, the keyboard path and the readable path
 * can never disagree.
 */

import type { EntityRef, Gate, ObservationPlan, OpportunityPlan, PortalPlan, PreparationPlan, SceneId, ScenePlan, SemanticBeat } from './contracts/semantic.ts';
import type { EntityState, PlaybackManifestV3 } from './contracts/manifest.ts';
import type { RuntimeSnapshot } from './contracts/state.ts';
import { isPaused } from './ClockService.ts';

export const sceneById = (m: PlaybackManifestV3, id: SceneId): ScenePlan | undefined => m.scenePlans.find(s => s.id === id);
export const currentScene = (m: PlaybackManifestV3, s: RuntimeSnapshot): ScenePlan => sceneById(m, s.scene)!;
export const entityOf = (s: RuntimeSnapshot, id: string): EntityState | undefined => s.entities.find(e => e.id === id);

/** Where an entity is, following carriers (an object held by an actor is where the actor is). */
export function entityLocation(s: RuntimeSnapshot, id: string, depth = 0): string | undefined {
  const e = entityOf(s, id);
  if (!e || depth > 3) return undefined;
  if (e.owner.kind === 'location') return e.owner.id;
  if (e.owner.kind === 'actor') return entityLocation(s, e.owner.id, depth + 1);
  return undefined;
}

export function evaluateGate(g: Gate, s: RuntimeSnapshot): boolean {
  switch (g.kind) {
    case 'always':
      return true;
    case 'beat_delivered':
      return s.deliveredBeats.includes(g.id);
    case 'fact_received':
      return s.receivedFacts.includes(g.id);
    case 'entity_at':
      return entityLocation(s, g.id) === g.location;
    case 'state_is':
      return s.variables[g.key] === g.value;
    case 'all':
      return g.gates.every(x => evaluateGate(x, s));
  }
}

export const sameRef = (a: EntityRef, b: EntityRef): boolean => a.kind === b.kind && (a.kind === 'self' || (a as { id: string }).id === (b as { id: string }).id);

/** First undelivered beat of the current scene whose prerequisites are all delivered. */
export function nextBeat(m: PlaybackManifestV3, s: RuntimeSnapshot): SemanticBeat | undefined {
  const scene = sceneById(m, s.scene);
  return scene?.beats.find(b => !s.deliveredBeats.includes(b.id) && b.after.every(a => s.deliveredBeats.includes(a)));
}

export function sceneObservations(m: PlaybackManifestV3, s: RuntimeSnapshot): ObservationPlan[] {
  const ids = currentScene(m, s).observationIds;
  return ids.map(id => m.observations.find(o => o.id === id)).filter((o): o is ObservationPlan => !!o);
}

export function observationAvailable(m: PlaybackManifestV3, s: RuntimeSnapshot, o: ObservationPlan): boolean {
  return currentScene(m, s).observationIds.includes(o.id) && evaluateGate(o.available, s);
}

export function preparationAvailable(s: RuntimeSnapshot, p: PreparationPlan): boolean {
  return evaluateGate(p.available, s);
}
export const preparationApplied = (s: RuntimeSnapshot, id: string) => s.preparations.some(p => p.id === id);

export type OpportunityBlock = 'wrong_scene' | 'decided' | 'gate' | 'knowledge_missing' | 'locked';

/** Why an option cannot be chosen right now, or undefined when it can. */
export function opportunityBlock(m: PlaybackManifestV3, s: RuntimeSnapshot, o: OpportunityPlan): OpportunityBlock | undefined {
  const d = m.primaryDecision;
  if (!d || !d.options.includes(o.id)) return 'wrong_scene';
  if (s.decision) return 'decided';
  if (s.boundaryLocked) return 'locked';
  if (s.scene !== d.scene || !currentScene(m, s).opportunityIds.includes(o.id)) return 'wrong_scene';
  if (!d.minimumKnowledge.every(f => s.receivedFacts.includes(f))) return 'knowledge_missing';
  if (!evaluateGate(o.available, s)) return 'gate';
  return undefined;
}

export type PortalBlock = 'wrong_scene' | 'gate' | 'closed' | 'ahead_of_arc' | 'not_next' | 'locked';

export function portalBlock(m: PlaybackManifestV3, s: RuntimeSnapshot, p: PortalPlan): PortalBlock | undefined {
  if (s.boundaryLocked) return 'locked';
  if (p.fromScene !== s.scene) return 'wrong_scene';
  if (s.variables[`portal_${p.id}`] === 'closed') return 'closed';
  if (!evaluateGate(p.available, s)) return 'gate';
  const idx = m.spine.indexOf(p.toScene);
  if (p.kind === 'spine' && idx !== s.arcIndex + 1) return 'not_next';
  if (p.kind === 'excursion' && idx > s.arcIndex) return 'ahead_of_arc';
  return undefined;
}

export const scenePortals = (m: PlaybackManifestV3, s: RuntimeSnapshot): PortalPlan[] => m.portals.filter(p => p.fromScene === s.scene);

/** Actions that belong to a target, for the contextual (Enter) path. */
export function targetActions(m: PlaybackManifestV3, s: RuntimeSnapshot, target: EntityRef) {
  return {
    observations: sceneObservations(m, s).filter(o => sameRef(o.target, target) && observationAvailable(m, s, o)),
    preparations: m.preparations.filter(p => sameRef(p.target, target) && preparationAvailable(s, p)),
    portals: scenePortals(m, s).filter(p => target.kind === 'portal' && target.id === p.id && !portalBlock(m, s, p)),
    opportunities: m.opportunities.filter(o => sameRef(o.target, target) && !opportunityBlock(m, s, o)),
  };
}

/** Is `target` something that exists in this manifest? */
export function targetExists(m: PlaybackManifestV3, target: EntityRef): boolean {
  switch (target.kind) {
    case 'self':
      return true;
    case 'portal':
      return m.portals.some(p => p.id === target.id);
    default:
      return m.initialEntities.some(e => e.id === target.id && e.kind === target.kind);
  }
}

/**
 * Locomotion eligibility: only while freely playing, with nothing open and no
 * pause in force. A scene change or a hidden tab makes it false immediately.
 */
export function movementEligible(s: RuntimeSnapshot): boolean {
  return s.phase === 'playing' && !s.sheet && !s.openObservation && !s.modal && !s.transition && !isPaused(s.time);
}
