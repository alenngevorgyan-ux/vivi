/**
 * THE CORRECTION — what Design plugs in, per scene and per act (public, pre-boundary).
 *
 * The runtime publishes `VisualHooksV3` (src/components/experience/v3/visualHooks.ts).
 * This table names, for each Correction scene and option, the semantic slots
 * Design fills and the gold constraint each slot must honour. It holds no
 * geometry, no art and no reveal: every string below is read from the public
 * gold envelope, is a structural id, or is an editorially APPROVED intention
 * label (B08, reports/v3-blocker-closure-review.md). Nothing here is invented
 * dialogue: the three captions are complete-intention labels, not speech.
 */

import { CORRECTION_ENVELOPE, type CorrectionVariant } from './theCorrection.ts';

const env = CORRECTION_ENVELOPE as unknown as {
  title: string;
  hook: string;
  stagingDisclosure: string;
  evidenceFacts: Array<{ id: string; claim: string }>;
  observations: Array<{ id: string; accessibleEquivalent: string }>;
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
  /** Compiled hero mark roles the scene carries (entry, reposition targets, the private-request approach). */
  requiredMarks: string[];
  /** Geometry anchors the scene needs: display surfaces and door anchors (runtime resource, not marks). */
  requiredAnchors: string[];
  /** The Design geometry this slot is staged with. */
  geometry: string;
}

/** Enactment copy and frames per option. Acceptance is already immutable when any of this plays. */
export interface ActDesignSlot {
  option: string;
  label: string;
  confirmation: { copy: string; confirm: string; cancel: string };
  /** The approved complete-intention label shown with the enactment (B08). Never quoted speech. */
  caption: { status: 'approved'; text: string; approval: string };
  physicalEnactment: string;
  finalPose: string;
  stopFrame: string;
}

const RICH_SCENES: Record<string, { gold: string; marks: string[]; anchors: string[] }> = {
  c_desk: { gold: 'c_desk', marks: ['at_desk'], anchors: ['o_deck'] },
  c_meeting_before: { gold: 'c_meeting_before', marks: ['entry'], anchors: ['o_slide', 'a_mira', 'a_director', 'p_hall'] },
  c_hallway: { gold: 'c_hallway', marks: ['reading'], anchors: ['p_room'] },
  c_meeting_question: { gold: 'c_meeting_question', marks: ['entry', 'own_seat', 'near_director', 'ask_director'], anchors: ['o_slide', 'a_mira', 'a_director'] },
};
const STAGED = 'Design r4 (correction-geo-r4 / correction-assets-r4)';

export function correctionSceneSlots(variant: CorrectionVariant = 'rich'): SceneDesignSlot[] {
  if (variant === 'compressed') {
    return [
      { scene: 'c_compressed_before', goldScene: 'c_desk', composition: 'c_compressed_recollection_frame', actorsInView: ['a_me'], objectsInView: ['o_summary'], inserts: ['obs_title'], requiredMarks: ['entry'], requiredAnchors: ['o_slide'], geometry: `${STAGED}, meeting room` },
      { scene: 'c_compressed_meeting', goldScene: 'c_meeting_before + c_hallway + c_meeting_question', composition: 'c_compressed_meeting_frame', actorsInView: ['a_me', 'a_mira', 'a_director'], objectsInView: ['o_slide', 'o_summary'], inserts: ['obs_summary'], requiredMarks: ['entry', 'own_seat', 'near_director', 'ask_director'], requiredAnchors: ['o_slide', 'a_mira', 'a_director'], geometry: `${STAGED}, meeting room` },
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
      requiredAnchors: x.anchors,
      geometry: STAGED,
    };
  });
}

/**
 * The approved complete-intention labels (B08 closed: review/vivi-v3-blocker-closure @ a8a4a7a,
 * reports/v3-blocker-closure-review.md). The single canonical option → caption binding: live intention controls,
 * enactment captions and Design's intent.speak / intent.private / intent.pass slots all read it here.
 */
export const APPROVED_INTENTION_CAPTIONS: Readonly<Record<string, string>> = {
  correct_public: 'Say I built the forecast',
  request_private: 'Ask the director to clarify my credit privately afterward',
  pass_question: 'Let this question pass without speaking',
};
const CAPTION_APPROVAL = 'B08 · review/vivi-v3-blocker-closure @ a8a4a7af8777caa29c5d41370c62f14357da045c';

export function correctionActSlots(): ActDesignSlot[] {
  return env.opportunities.map(o => {
    const text = APPROVED_INTENTION_CAPTIONS[o.id];
    if (!text) throw new Error(`no approved intention caption for ${o.id}`);
    return {
      option: o.id,
      label: o.label,
      confirmation: { copy: o.confirmationCopy, confirm: o.confirmLabel, cancel: o.cancelLabel },
      caption: { status: 'approved', text, approval: CAPTION_APPROVAL },
      physicalEnactment: o.physicalEnactment,
      finalPose: o.finalPose,
      stopFrame: o.stopFrame,
    };
  });
}

/** The first quoted span of a Gold claim, verbatim (curly quotes as authored). */
const quoted = (factId: string): string => {
  const f = env.evidenceFacts.find(x => x.id === factId);
  const m = f && /“([^”]+)”/.exec(f.claim);
  if (!m) throw new Error(`gold fact ${factId} quotes nothing`);
  return m[1];
};

/**
 * Public copy the player shows, every string Gold-backed: the title/hook/disclosure of the envelope, the one
 * approved display title (Design `display.title`, Gold F03 / obs_title), the director's exact Gold question (F11)
 * and the observations' readable equivalents. No protagonist dialogue exists here before the private reveal.
 */
export function correctionPublicCopy() {
  return {
    title: env.title,
    hook: env.hook,
    disclosure: env.stagingDisclosure,
    /** Design copy slot display.title, APPROVED: “Mira’s forecast”. Live DOM on the display surface, never raster. */
    displayTitle: quoted('F03'),
    /** Gold F11, verbatim. */
    directorQuestion: quoted('F11'),
    observations: Object.fromEntries(env.observations.map(o => [o.id, o.accessibleEquivalent])) as Record<string, string>,
  };
}

/** Presentation-only ambient cue ids (never a scene beat, never a fact). */
export const correctionAmbientCues = (): string[] => env.softTimeEvents.filter(e => e.classification === 'ambient').map(e => e.id);
