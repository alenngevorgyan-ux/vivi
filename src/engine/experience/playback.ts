import type { AuthorTruth } from '../runtime/generationPipeline.ts';
import type { CanonicalScenario, RuntimeAction } from '../runtime/RuntimeCompiler.ts';
import { enactmentOf, meaningOf } from './meaning.ts';
import { EXPERIENCE_VERSION, type CommitmentSpec, type ExperienceV2, type ObservationSpec } from './types.ts';

/**
 * What the player runtime receives, and what it does not.
 *
 * A scene is split before playback into the part the stage may see and a
 * sealed reveal that is opened only after a commitment. In this build every
 * post lives in the author's own browser (localStorage) and curated stories
 * are bundled, so this is a structural boundary inside one client — it keeps
 * the stage, the camera and the action list from ever touching the outcome,
 * but it is not protection against someone reading the payload. That needs a
 * server that stores posts and releases a reveal only for a recorded choice;
 * see docs/VIVI_EXPERIENCE_V2.md.
 */

export interface SealedReveal {
  truth: AuthorTruth;
  /** Which offered deed the author took, when it is known. Shown as "the author", never as "correct". */
  authorChoiceId?: string;
}

export interface PlaybackBundle {
  scene: CanonicalScenario;
  experience: ExperienceV2;
  sealed: SealedReveal;
}

export function sealForPlayback(scenario: CanonicalScenario): PlaybackBundle {
  const sealed: SealedReveal = {
    truth: scenario.authorTruth ?? (scenario.reality ? { status: 'author_supplied', text: scenario.reality } : { status: 'withheld' }),
    ...(scenario.authorChoiceId ? { authorChoiceId: scenario.authorChoiceId } : {}),
  };
  const scene: CanonicalScenario = {
    ...scenario,
    reality: '',
    authorTruth: { status: 'withheld' },
    authorChoiceId: undefined,
    // Generated "next moments" may describe other people's reactions; the V2 player never shows them.
    endings: {},
    beats: scenario.beats.map(b => (b.type === 'reveal' ? { ...b, description: '' } : b)),
    seededStats: [],
    communityReflections: [],
  };
  return { scene, experience: experienceFor(scenario), sealed };
}

/* ------------------------------------------------------------ legacy adapter --- */

/** Hero stories written before verbs existed name their actions; read the verb off the id, never off the label. */
const LEGACY_VERB_BY_ID: Record<string, string> = {
  phone: 'read', read: 'read', map: 'read', document: 'read', photo: 'look', letter: 'read', envelope: 'keep', laptop: 'show',
  bathroom: 'ask', director: 'ask', friend: 'tell', sister: 'answer', stranger: 'refuse', partner: 'confront', person: 'stay', table: 'ask', reply: 'ask',
  interrupt: 'speak_up', intercom: 'answer',
  sofa: 'wait', wait: 'wait', quiet: 'wait', bench: 'stay',
  away: 'leave', exit: 'leave', leave: 'leave', door: 'leave', stairs: 'ask', stop: 'leave', train: 'board', board: 'board', walk: 'follow',
  peephole: 'look', window: 'call_help', corner: 'tell', hide: 'hide', room: 'look', balcony: 'call',
};

const cueOf = (scenario: CanonicalScenario): number => {
  const cue = scenario.beats.find(b => b.isCue || b.type === 'cue');
  return scenario.cinematic?.cueAtMs ?? (typeof cue?.triggerPayload === 'number' ? cue.triggerPayload : 5000);
};

function targetOf(action: RuntimeAction) {
  return {
    targetSlot: action.targetSlot,
    ...(action.actorId ? { actorId: action.actorId } : {}),
    ...(action.objectId ? { objectId: action.objectId } : {}),
    ...(action.slotInfo.carried ? { carried: true } : {}),
  };
}

/**
 * Experience V2 for a scene. Compiled V2 scenes carry their own; anything
 * older is adapted here, explicitly and without changing the stored scene:
 * each old action becomes one look (its old "walk up" line and observation)
 * and one deed (its old commit label). The old generated "next moment" text
 * is not carried over — it could describe a reaction nobody reported.
 */
export function experienceFor(scenario: CanonicalScenario): ExperienceV2 {
  if (scenario.experience?.version === EXPERIENCE_VERSION) return scenario.experience;

  const observations: ObservationSpec[] = scenario.actions
    .filter(a => a.observation?.trim())
    .map(a => ({ id: `look_${a.id}`, label: a.label, reveals: a.observation, sourced: false, ...targetOf(a) }));

  const commitments: CommitmentSpec[] = scenario.actions.map(a => {
    const verb = a.verb ?? LEGACY_VERB_BY_ID[a.id] ?? 'wait';
    const target = { objectId: a.objectId, person: !!a.actorId };
    return { id: a.id, label: a.commitLabel, verb, meaning: meaningOf(verb, target), enactment: enactmentOf(verb, target), ...targetOf(a) };
  });

  return {
    version: EXPERIENCE_VERSION,
    format: 'playable',
    missing: [],
    facts: [],
    observations,
    commitments,
    orientationMs: Math.max(1500, cueOf(scenario)),
    boundary: { mode: 'none', removedChars: 0 },
    origin: 'legacy_adapter',
  };
}
