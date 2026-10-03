import { worldTemplates, type ViviWorldId } from '../../world/templates/index.ts';
import type { ViviCharacterId, CharacterPose } from '../../assets/characters/characters.ts';
import type { ExperienceModifier, ModifierKind } from '../modifiers/types.ts';
import type { StoryBeat, BeatTrigger, BeatType } from './StoryBeatRunner.ts';
import { resolveSemanticSlot } from './semanticSlots.ts';
import type { CanonicalScenario, RuntimeAction, CrowdStat, CommunityReflection } from './RuntimeCompiler.ts';
import type { ViviExperienceDSL } from '../compiler/dsl.ts';

export type AuthorTruthStatus =
  | 'author_supplied'
  | 'withheld'
  | 'fictional_demo'
  /** Reserved for documented-history experiences; only set when source references exist. */
  | 'documented_source';

export interface AuthorTruth {
  status: AuthorTruthStatus;
  /** What the author did. Preserved exactly as written. */
  text?: string;
  /** Optional: why they did it, in their words. Never filled by a model. */
  why?: string;
  /** Optional: what happened afterwards, in their words. */
  after?: string;
  sourceLabel?: string;
  withheldReason?: string;
  /** Required for `documented_source`; never produced by a model. */
  sourceRefs?: string[];
}

export interface StoryAnalysis {
  setting: string;
  people: string[];
  emotionalCore: string;
  centralTension: string;
  pivotalMoment: string;
  importantObjects: string[];
  actualOutcome?: string;
  experienceGrammar: string;
  themeKey: string;
}

export interface InteractionPlan {
  id: string;
  targetSlot: string;
  label: string;
  observation: string;
  commitLabel: string;
}

export interface CommitmentPlan {
  id: string;
  targetSlot: string;
  label: string;
  outcome: string;
}

export interface ExperiencePlan {
  id: string;
  title: string;
  synopsis: string;
  worldTemplate: ViviWorldId;
  durationMinutes: number;
  cast: Array<{
    role: string;
    character: ViviCharacterId;
    slot: string;
    pose: CharacterPose;
  }>;
  beats: StoryBeat[];
  interactions: InteractionPlan[];
  modifiers: ExperienceModifier[];
  commitments: CommitmentPlan[];
  authorTruth: AuthorTruth;
  crowdQuestion: string;
  responsePrompt: string;
  /** The semantic program this plan was compiled from (compiled experiences only). */
  dsl?: ViviExperienceDSL;
  compiler?: CompilerStamp;
}

/** Which compiler produced a post, from which DSL, and where that DSL came from. */
export interface CompilerStamp {
  dslVersion: number;
  compilerVersion: string;
  source: 'model' | 'deterministic' | 'hero_fixture' | 'manual' | 'legacy';
  model?: string;
  /** Authoritative model usage when the provider reports it. */
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  /** Serialized DSL size in bytes. */
  dslBytes?: number;
  repaired?: boolean;
  fallbackReason?: string;
}

export interface StoredPlayablePost {
  id: string;
  schemaVersion: 2;
  /** Experience V2: how this story is presented. Absent on posts saved before V2 (they play as before). */
  format?: 'playable' | 'illustrated_memory' | 'text_story';
  title: string;
  author: string;
  authorHandle?: string;
  pillar?: string;
  world?: string;
  synopsis: string;
  scenario: CanonicalScenario;
  analysis?: StoryAnalysis;
  experiencePlan?: ExperiencePlan;
  legacyGameSpec?: any;
  responseToPostId?: string;
  themeKey?: string;
  inspirationPrompt?: string;
  createdAt: number;
  /** Compiled posts keep their semantic program so a newer compiler can replay it. */
  dsl?: ViviExperienceDSL;
  compiler?: CompilerStamp;
}

export function isStoredPlayablePost(item: any): item is StoredPlayablePost {
  return (
    item != null &&
    typeof item === 'object' &&
    item.schemaVersion === 2 &&
    typeof item.scenario === 'object' &&
    typeof item.scenario?.id === 'string'
  );
}

export const WORLD_ALLOWED_SLOTS: Record<ViviWorldId, Set<string>> = {
  apartment_night: new Set([
    'sofa', 'phone_table', 'kitchen', 'bathroom_door', 'window', 'hallway',
    'front_door', 'bedroom', 'decision_center', 'phone_screen', 'door'
  ]),
  hallway_night: new Set([
    'front_door', 'elevator', 'stairs', 'camera', 'intercom',
    'emergency_light', 'window', 'long_sight_line', 'decision_center', 'door'
  ]),
  bar_or_party: new Set([
    'tables', 'bar', 'bathroom_corridor', 'exit', 'crowd_clusters',
    'phone_area', 'quiet_corner', 'decision_center', 'entrance'
  ]),
  office_night: new Set([
    'presentation_screen', 'director', 'coworker', 'player_laptop',
    'meeting_clock', 'exit', 'decision_center'
  ]),
  train_station: new Set([
    'station_board', 'platform_edge', 'bench', 'clock', 'train',
    'exit', 'decision_center'
  ]),
  city_rain: new Set([
    'shelter', 'crossing', 'street', 'car', 'window', 'decision_center'
  ]),
  family_home: new Set([
    'documents', 'stair_door', 'photo_wall', 'window', 'dining_table',
    'decision_center'
  ]),
  hotel_or_rental: new Set([
    'photo', 'front_door', 'kitchen', 'balcony', 'bedroom',
    'decision_center', 'door'
  ]),
  neighborhood_sunset: new Set([
    'bench', 'bus_stop', 'tree', 'path', 'clock', 'friend', 'decision_center'
  ]),
  bedroom_night: new Set([
    'bed', 'phone_screen', 'door', 'window', 'nightstand', 'decision_center'
  ]),
};

const GENERAL_MODIFIER_ANCHORS = new Set(['audio', 'room', 'player', 'lighting', 'ambient']);

export const VALID_MODIFIER_KINDS: Set<string> = new Set([
  'timer', 'message', 'typing', 'incoming_call', 'call',
  'door_state', 'door', 'sound', 'elevator', 'npc_move',
  'npc_dialogue', 'npcPressure', 'lighting', 'weather',
  'arrival', 'exit', 'crowd',
]);

export const VALID_BEAT_TRIGGERS: Set<string> = new Set([
  'time_elapsed', 'player_entered_zone', 'object_inspected',
  'npc_reached_slot', 'dialogue_finished', 'modifier_finished',
  'player_committed', 'previous_beat_complete',
]);

export const VALID_BEAT_TYPES: Set<string> = new Set([
  'arrival', 'freeExplore', 'cue', 'interaction', 'conversation',
  'movement', 'silence', 'memoryEcho', 'pressure', 'commitment',
  'reveal', 'compare', 'response',
]);

export const VALID_CHARACTER_IDS: Set<string> = new Set([
  'young_adult_masc_01', 'adult_fem_01', 'young_adult_masc_02', 'elder_masc_01',
]);

export const VALID_CHARACTER_POSES: Set<string> = new Set([
  'idle', 'wait', 'talk', 'turn', 'leave', 'look_at_phone', 'confront', 'read',
]);

/**
 * Legacy ExperiencePlan (pre-DSL) compatibility. New experiences are compiled
 * from the Experience DSL (src/engine/compiler); this validator and
 * `compileExperiencePlanToScenario` remain so plans written in the older,
 * verbose format still load.
 *
 * Validates an ExperiencePlan ensuring semantic correctness, safety, and strict slot matching.
 * Strictly rejects any raw x/y coordinates and impossible slots for the chosen world.
 */
export function validateExperiencePlan(input: any): { valid: true; plan: ExperiencePlan } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { valid: false, errors: ['ExperiencePlan must be a valid JSON object.'] };
  }

  // 1. World template validation
  if (!input.worldTemplate || !worldTemplates[input.worldTemplate as ViviWorldId]) {
    errors.push(`Invalid or missing worldTemplate: "${input.worldTemplate}". Must be one of the 10 known Vivi worlds.`);
  }

  const worldId = (input.worldTemplate as ViviWorldId) || 'apartment_night';
  const allowedSlots = WORLD_ALLOWED_SLOTS[worldId] || new Set(['decision_center']);

  // 2. Reject raw coordinates
  const jsonStr = JSON.stringify(input);
  if (jsonStr.includes('"x"') || jsonStr.includes('"y"') || jsonStr.includes('"coordinates"')) {
    errors.push('Raw x/y coordinates are strictly forbidden in ExperiencePlan. Use semantic slots only.');
  }

  // 3. Commitments count validation (2 to 5)
  if (!Array.isArray(input.commitments) || input.commitments.length < 2 || input.commitments.length > 5) {
    errors.push(`ExperiencePlan must have between 2 and 5 commitments (found ${input.commitments?.length || 0}).`);
  } else {
    for (const commit of input.commitments) {
      if (!commit.targetSlot) {
        errors.push(`Commitment "${commit.id}" missing targetSlot.`);
      } else if (!allowedSlots.has(commit.targetSlot)) {
        errors.push(`Commitment slot "${commit.targetSlot}" is invalid for world template "${worldId}".`);
      }
    }
  }

  // 4. Validate interactions
  if (!Array.isArray(input.interactions) || input.interactions.length < 2) {
    errors.push('ExperiencePlan must define at least 2 physical interactions.');
  } else {
    for (const inter of input.interactions) {
      if (!inter.targetSlot) {
        errors.push(`Interaction "${inter.id}" missing targetSlot.`);
      } else if (!allowedSlots.has(inter.targetSlot)) {
        errors.push(`Interaction slot "${inter.targetSlot}" is invalid for world template "${worldId}".`);
      }
      if (!inter.label || inter.label.length > 45) {
        errors.push(`Interaction "${inter.id}" label must be between 1 and 45 characters.`);
      }
    }
  }

  // 5. Validate cast
  if (Array.isArray(input.cast)) {
    for (const castMember of input.cast) {
      if (castMember.slot && !allowedSlots.has(castMember.slot)) {
        errors.push(`Cast slot "${castMember.slot}" is invalid for world template "${worldId}".`);
      }
      if (castMember.character && !VALID_CHARACTER_IDS.has(castMember.character)) {
        errors.push(`Invalid character ID: "${castMember.character}".`);
      }
      if (castMember.pose && !VALID_CHARACTER_POSES.has(castMember.pose)) {
        errors.push(`Invalid character pose: "${castMember.pose}".`);
      }
    }
  }

  // 6. Validate modifiers
  if (Array.isArray(input.modifiers)) {
    for (const mod of input.modifiers) {
      if (!VALID_MODIFIER_KINDS.has(mod.kind)) {
        errors.push(`Invalid modifier kind: "${mod.kind}".`);
      }
      if (typeof mod.atMs !== 'number' || mod.atMs < 0) {
        errors.push(`Modifier "${mod.id}" must have a non-negative atMs timing.`);
      }
      if (mod.anchor && !allowedSlots.has(mod.anchor) && !GENERAL_MODIFIER_ANCHORS.has(mod.anchor)) {
        errors.push(`Modifier anchor "${mod.anchor}" is invalid for world template "${worldId}".`);
      }
    }
  }

  // 7. Validate beats
  if (Array.isArray(input.beats)) {
    for (const beat of input.beats) {
      if (beat.type && !VALID_BEAT_TYPES.has(beat.type)) {
        errors.push(`Invalid beat type: "${beat.type}".`);
      }
      if (beat.trigger && !VALID_BEAT_TRIGGERS.has(beat.trigger)) {
        errors.push(`Invalid beat trigger: "${beat.trigger}".`);
      }
    }
  }

  // 8. Validate author truth
  if (!input.authorTruth || typeof input.authorTruth !== 'object') {
    errors.push('ExperiencePlan must specify authorTruth with status "author_supplied", "withheld", or "fictional_demo".');
  } else {
    const status = input.authorTruth.status;
    if (status !== 'author_supplied' && status !== 'withheld' && status !== 'fictional_demo') {
      errors.push(`Invalid authorTruth status: "${status}". Must be "author_supplied", "withheld", or "fictional_demo".`);
    } else if ((status === 'author_supplied' || status === 'fictional_demo') && (!input.authorTruth.text || !input.authorTruth.text.trim())) {
      errors.push(`AuthorTruth status is "${status}" but contains empty text.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, plan: input as ExperiencePlan };
}

/**
 * Compiles a validated ExperiencePlan directly into a CanonicalScenario for the runtime.
 */
export function compileExperiencePlanToScenario(
  plan: ExperiencePlan,
  analysis: StoryAnalysis,
  author: string = 'Anonymous',
  responseToPostId?: string
): CanonicalScenario {
  const world = plan.worldTemplate;

  const actions: RuntimeAction[] = plan.interactions.map((inter) => {
    const slotInfo = resolveSemanticSlot(world, inter.targetSlot);
    return {
      id: inter.id,
      targetSlot: inter.targetSlot,
      slotInfo,
      label: inter.label,
      observation: inter.observation,
      commitLabel: inter.commitLabel,
    };
  });

  const endings: Record<string, string> = {};
  for (const commit of plan.commitments) {
    endings[commit.id] = commit.outcome;
  }
  // Also map interaction IDs to endings
  for (const act of actions) {
    if (!endings[act.id]) {
      const match = plan.commitments.find(c => c.targetSlot === act.targetSlot) || plan.commitments[0];
      endings[act.id] = match?.outcome || 'You make your move. The tension changes the room.';
    }
  }

  // Seed honest demo stats with explicit provenance
  const totalDemoVotes = 100;
  const count = actions.length;
  const rawP = [52, 28, 20, 10, 10].slice(0, count);
  const sumP = rawP.reduce((a, b) => a + b, 0);
  const seededStats: CrowdStat[] = actions.map((act, i) => {
    const pct = Math.round((rawP[i] / sumP) * 100);
    return {
      choiceId: act.id,
      label: act.commitLabel,
      percentage: pct,
      count: Math.round(totalDemoVotes * (pct / 100)),
      source: 'seed_demo' as const,
    };
  });

  const reflections: CommunityReflection[] = [
    {
      id: `ref_demo_${Date.now()}`,
      authorHandle: '@reader_sample',
      authorName: 'Sample Reader (демо)',
      text: 'The hesitation before deciding is captured so well here.',
      timestamp: 'Пример отклика (демо)',
      upvotes: 4,
      source: 'seed_demo' as const,
    },
  ];

  const authorHandle = author.startsWith('@') ? author : `@${author.toLowerCase().replace(/\s+/g, '_')}`;

  const hasReality =
    plan.authorTruth.status === 'author_supplied' || plan.authorTruth.status === 'fictional_demo';

  return {
    id: plan.id,
    title: plan.title,
    hook: plan.synopsis,
    setup: analysis.centralTension || plan.synopsis,
    synopsis: plan.synopsis,
    author,
    authorHandle,
    duration: `${plan.durationMinutes || 3} min`,
    pillar: analysis.themeKey || 'Human Moment',
    world: plan.worldTemplate,
    playerSpawn: [38, 77],
    playerCharacter: 'young_adult_masc_01',
    npc: plan.cast[0]
      ? {
          id: plan.cast[0].role,
          character: plan.cast[0].character,
          slot: plan.cast[0].slot,
          initialPose: (['idle', 'wait', 'talk', 'turn', 'leave'].includes(plan.cast[0].pose as string)
            ? (plan.cast[0].pose as 'idle' | 'wait' | 'talk' | 'turn' | 'leave')
            : 'wait'),
        }
      : undefined,
    actions,
    beats: plan.beats,
    modifiers: plan.modifiers,
    endings,
    reality: hasReality ? plan.authorTruth.text || '' : '',
    crowdQuestion: plan.crowdQuestion || 'What would you do?',
    seededStats,
    communityReflections: reflections,
    responsePrompt: plan.responsePrompt || 'Have you lived through a moment like this?',
    themeKey: analysis.themeKey,
    authorTruth: plan.authorTruth,
    responseToPostId,
  };
}
