/**
 * The readable projection: everything a player can see or do, as plain data,
 * with no renderer, no coordinates and no pointer.
 *
 * It exists so that every required action is reachable without precise
 * pointer movement (list observations, list actions, request a portal,
 * inspect received facts, make the same decision) and so that the keyboard
 * sheet, the pointer targets and a screen reader all read ONE answer to
 * "what is available". The future ReadableView component renders this; it
 * does not decide anything.
 */

import type { EntityRef, FactKind, IntentVerb } from './contracts/semantic.ts';
import type { PlaybackManifestV3 } from './contracts/manifest.ts';
import type { RuntimeSnapshot } from './contracts/state.ts';
import type { ExperienceEvent } from './ExperienceController.ts';
import { currentScene, nextBeat, observationAvailable, opportunityBlock, portalBlock, preparationApplied, preparationAvailable, scenePortals, sceneObservations, type OpportunityBlock, type PortalBlock } from './queries.ts';

export interface ReadableModel {
  scene: { id: string; location: string; purpose: string; kind: string };
  phase: RuntimeSnapshot['phase'];
  /** Facts received so far, in the order they were received. */
  facts: Array<{ id: string; text: string; kind: FactKind }>;
  /** Required-for-this-scene facts the player has not received yet. */
  pendingRequiredFacts: string[];
  observations: Array<{ id: string; label: string; target: EntityRef; available: boolean; seen: boolean }>;
  preparations: Array<{ id: string; label: string; target: EntityRef; available: boolean; applied: boolean }>;
  portals: Array<{ id: string; label: string; kind: 'spine' | 'excursion'; available: boolean; blockedBy?: PortalBlock }>;
  /** The options of the one primary decision, when this scene offers it. */
  actions: Array<{ id: string; label: string; motive: string; verb: IntentVerb; available: boolean; blockedBy?: OpportunityBlock }>;
  decision: { status: 'none' | 'reserved' | 'accepted' | 'recorded'; reserved?: string; accepted?: string; missingKnowledge: string[] };
  canAdvance: boolean;
}

export function buildReadableModel(m: PlaybackManifestV3, s: RuntimeSnapshot): ReadableModel {
  const scene = currentScene(m, s);
  const factText = new Map(m.facts.map(f => [f.id, f] as const));
  const locked = s.boundaryLocked;
  const d = m.primaryDecision;
  const offered = d && s.scene === d.scene;

  return {
    scene: { id: scene.id, location: scene.location, purpose: scene.purpose, kind: scene.kind },
    phase: s.phase,
    facts: s.receivedFacts.map(id => factText.get(id)!).filter(Boolean),
    pendingRequiredFacts: scene.requiredFacts.filter(f => !s.receivedFacts.includes(f)),
    observations: sceneObservations(m, s).map(o => ({ id: o.id, label: o.label, target: o.target, available: !locked && observationAvailable(m, s, o), seen: s.seenObservations.includes(o.id) })),
    preparations: m.preparations.map(p => ({ id: p.id, label: p.label, target: p.target, available: !locked && preparationAvailable(s, p), applied: preparationApplied(s, p.id) })),
    portals: scenePortals(m, s).map(p => {
      const blockedBy = portalBlock(m, s, p);
      return { id: p.id, label: p.label, kind: p.kind, available: !blockedBy, blockedBy };
    }),
    actions: offered
      ? m.opportunities
          .filter(o => d!.options.includes(o.id))
          .map(o => {
            const blockedBy = opportunityBlock(m, s, o);
            return { id: o.id, label: o.label, motive: o.motive, verb: o.verb, available: !blockedBy, blockedBy };
          })
      : [],
    decision: {
      status: s.decision ? s.decision.status : s.reservation ? 'reserved' : 'none',
      reserved: s.reservation?.option,
      accepted: s.decision?.option,
      missingKnowledge: d && offered ? d.minimumKnowledge.filter(f => !s.receivedFacts.includes(f)) : [],
    },
    canAdvance: !locked && !!nextBeat(m, s),
  };
}

/**
 * The events that perform each readable item. A readable view dispatches
 * exactly these (with a fresh activation id for consequential ones), which
 * is what makes it the same state machine rather than a simplified story.
 */
export const readableEvents = {
  observe: (id: string, activationId?: string): ExperienceEvent => ({ type: 'OPEN_OBSERVATION', id, activationId }),
  prepare: (id: string, activationId?: string): ExperienceEvent => ({ type: 'APPLY_PREPARATION', id, activationId }),
  undoPreparation: (id: string, activationId?: string): ExperienceEvent => ({ type: 'REVERT_PREPARATION', id, activationId }),
  travel: (id: string, activationId?: string): ExperienceEvent => ({ type: 'REQUEST_PORTAL', id, activationId }),
  chooseAct: (id: string, activationId: string): ExperienceEvent => ({ type: 'REQUEST_INTENT', id, activationId }),
  confirmAct: (id: string, activationId: string): ExperienceEvent => ({ type: 'CONFIRM', id, activationId }),
  advance: (activationId?: string): ExperienceEvent => ({ type: 'ADVANCE', activationId }),
  cancel: (): ExperienceEvent => ({ type: 'CANCEL' }),
};
