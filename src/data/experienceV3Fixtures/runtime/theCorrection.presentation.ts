/**
 * THE CORRECTION — what Design plugs in, per scene and per act (public, pre-boundary).
 *
 * The runtime publishes `VisualHooksV3` (src/components/experience/v3/visualHooks.ts).
 * This table names, for each Correction scene and option, the semantic slots
 * Design fills and the gold constraint each slot must honour. It holds no
 * geometry, no art and no reveal: every string below is read from the public
 * gold envelope or is a structural id. Copy marked `pending_editorial` does
 * not exist in the gold source and must not be invented here.
 */

import { CORRECTION_ENVELOPE, type CorrectionVariant } from './theCorrection.ts';

const env = CORRECTION_ENVELOPE as unknown as {
  scenes: Array<{ id: string; composition: string; presentActors: string[]; persistentObjects: string[]; observationIds: string[]; preparationIds: string[]; purpose: string }>;
  opportunities: Array<{ id: string; label: string; confirmationCopy: string; confirmLabel: string; cancelLabel: string; physicalEnactment: string; finalPose: string; stopFrame: string }>;
  softTimeEvents: Array<{ id: string; classification: string }>;
};

/** Hooks every scene consumes (field names of VisualHooksV3). */
export const SCENE_HOOKS = [
  'phase',
  'scene',
  'scene.location',
  'transition',
  'actors',
  'objects',
  'knowledge.receivedFacts',
  'attention',
  'doors',
  'opportunity',
  'commitment',
  'boundary',
  'reveal.phase',
  'settings.reducedMotion',
  'settings.audio',
  'presentationEligible',
] as const;

export interface SceneDesignSlot {
  scene: string;
  goldScene: string;
  composition: string;
  /** Actors registered in view; anyone else is offstage or seen through an open door (`visibleThrough`). */
  actorsInView: string[];
  objectsInView: string[];
  /** Observation inserts Design draws; the fact text itself stays DOM text. */
  inserts: string[];
  /** Named marks Design's geometry export must provide (reposition targets and entry). */
  requiredMarks: string[];
  replaces: string;
}

/** Enactment copy and frames per option. Acceptance is already immutable when any of this plays. */
export interface ActDesignSlot {
  option: string;
  label: string;
  confirmation: { copy: string; confirm: string; cancel: string };
  /** Exact gold caption where the source supplies one; otherwise pending editorial — never improvised in code. */
  caption: { status: 'gold'; text: string } | { status: 'pending_editorial'; constraint: string };
  physicalEnactment: string;
  finalPose: string;
  stopFrame: string;
}

const RICH_SCENES: Record<string, { gold: string; marks: string[] }> = {
  c_desk: { gold: 'c_desk', marks: ['desk', 'deck_display'] },
  c_meeting_before: { gold: 'c_meeting_before', marks: ['own_seat', 'slide_display', 'threshold'] },
  c_hallway: { gold: 'c_hallway', marks: ['hall_threshold', 'door_jamb'] },
  c_meeting_question: { gold: 'c_meeting_question', marks: ['own_seat', 'near_director', 'slide_display'] },
};

export function correctionSceneSlots(variant: CorrectionVariant = 'rich'): SceneDesignSlot[] {
  if (variant === 'compressed') {
    return [
      { scene: 'c_compressed_before', goldScene: 'c_desk', composition: 'dev_placeholder_recollection_frame', actorsInView: ['a_me'], objectsInView: ['o_summary'], inserts: ['obs_title'], requiredMarks: ['own_seat'], replaces: 'dev-placeholder-1 meeting room, recollection frame' },
      { scene: 'c_compressed_meeting', goldScene: 'c_meeting_before + c_hallway + c_meeting_question', composition: 'dev_placeholder_meeting_frame', actorsInView: ['a_me', 'a_mira', 'a_director'], objectsInView: ['o_slide', 'o_summary'], inserts: ['obs_summary'], requiredMarks: ['own_seat', 'near_director', 'slide_display'], replaces: 'dev-placeholder-1 meeting room' },
    ];
  }
  return Object.entries(RICH_SCENES).map(([scene, x]) => {
    const g = env.scenes.find(s => s.id === x.gold)!;
    return {
      scene,
      goldScene: g.id,
      composition: g.composition,
      actorsInView: [...g.presentActors],
      objectsInView: [...g.persistentObjects],
      inserts: [...g.observationIds],
      requiredMarks: x.marks,
      replaces: `dev-placeholder-1 ${scene}`,
    };
  });
}

export function correctionActSlots(): ActDesignSlot[] {
  return env.opportunities.map(o => {
    // Gold supplies an exact caption for silence only (§J pass_question). The other two name the intention without a sentence.
    const quoted = /Caption: “([^”]+)”/.exec(o.physicalEnactment);
    return {
      option: o.id,
      label: o.label,
      confirmation: { copy: o.confirmationCopy, confirm: o.confirmLabel, cancel: o.cancelLabel },
      caption: quoted ? { status: 'gold', text: quoted[1] } : { status: 'pending_editorial', constraint: 'Caption names the complete intention without inventing a sentence; no NPC reaction (gold §J/§K).' },
      physicalEnactment: o.physicalEnactment,
      finalPose: o.finalPose,
      stopFrame: o.stopFrame,
    };
  });
}

/** Presentation-only ambient cue ids (never a scene beat, never a fact). */
export const correctionAmbientCues = (): string[] => env.softTimeEvents.filter(e => e.classification === 'ambient').map(e => e.id);
