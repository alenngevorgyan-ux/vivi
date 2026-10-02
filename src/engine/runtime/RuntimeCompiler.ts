import type { HeroStory } from '../../data/heroStories';
import type { GameSpec } from '../../types/gameSpec';
import { worldTemplates, type ViviWorldId } from '../../world/templates';
import type { ExperienceModifier } from '../modifiers/types';
import type { ViviCharacterId } from '../../assets/characters/characters';
import { resolveSemanticSlot, type SemanticSlotResolution } from './semanticSlots.ts';
import { StoryBeat } from './StoryBeatRunner.ts';
import type { AuthorTruth, AuthorTruthStatus } from './generationPipeline.ts';
import type { ShotCue } from '../cinematic/shotTypes';
import { validateDSL } from '../compiler/dsl.ts';
import { compileExperience } from '../compiler/ExperienceCompiler.ts';
import { WORLD_KNOWLEDGE } from '../compiler/worldKnowledge.ts';
import type { RuntimeActor, ActorCue } from './actors.ts';
import type { CameraEvent, CameraGrammarId } from '../cinematic/director.ts';
import type { StagingPreset } from '../cinematic/staging.ts';
import type { LightingProfileDef } from '../compiler/grammars.ts';
export type { AuthorTruth, AuthorTruthStatus };

export interface RuntimeAction {
  id: string;
  targetSlot: string;
  slotInfo: SemanticSlotResolution;
  label: string;
  observation: string;
  commitLabel: string;
  /** The action is a person, not a place: its standing spot follows that actor. */
  actorId?: string;
  /** Semantic verb this action commits to (compiled experiences). */
  verb?: string;
  /** Key object the action is about, if any. */
  objectId?: string;
  /** Label used while the action's person is out of sight (behind the door they left through). */
  awayLabel?: string;
}

/** A first-class story object: the phone, the envelope, the photograph. */
export interface RuntimeKeyObject {
  id: string;
  kind: string;
  slot: string;
  /** World anchor of the hosting slot. */
  pos: [number, number];
  /** When the object becomes active (lights up, rings, is noticed). */
  activeAtMs?: number;
  /** Whether the engine draws a prop for it; architecture (doors, screens) is already in the art. */
  prop: boolean;
  /** Actions that physically involve this object. */
  actionIds: string[];
}

/** How a compiled experience is filmed, lit and heard. */
export interface ScenarioCinematics {
  grammar: string;
  tone: string;
  cameraGrammar: CameraGrammarId;
  staging: StagingPreset;
  cameraEvents: CameraEvent[];
  /** Slot the opening and the main inserts favour. */
  focusSlot?: string;
  lighting: string;
  lightingDef: LightingProfileDef;
  bed: string;
  soundRestraint: number;
  cueAtMs: number;
  pressureAtMs: number;
  revealHoldMs: number;
}

export interface ScenarioProvenance {
  dslVersion: number;
  compilerVersion: string;
  source: 'model' | 'deterministic' | 'hero_fixture' | 'manual' | 'legacy';
  model?: string;
}

export interface CrowdStat {
  choiceId: string;
  label: string;
  percentage: number;
  count: number;
  source?: 'seed_demo' | 'local' | 'live';
}

export interface CommunityReflection {
  id: string;
  authorHandle: string;
  authorName: string;
  avatarSeed?: string;
  choiceMadeId?: string;
  choiceLabel?: string;
  text: string;
  timestamp: string;
  isAuthorResponse?: boolean;
  upvotes?: number;
  source?: 'seed_demo' | 'user_local' | 'live';
}

export interface CanonicalScenario {
  id: string;
  title: string;
  hook: string;
  setup: string;
  synopsis?: string;
  author: string;
  authorHandle: string;
  duration: string;
  pillar: string;
  world: ViviWorldId;
  playerSpawn: [number, number];
  playerCharacter: ViviCharacterId;
  timerAnchor?: string;
  npc?: {
    id: string;
    character: ViviCharacterId;
    slot: string;
    initialPose: 'idle' | 'wait' | 'turn' | 'talk' | 'leave';
  };
  actions: RuntimeAction[];
  beats: StoryBeat[];
  /** Authored camera cues, replayed from scene start. Optional: generated posts have none. */
  shots?: ShotCue[];
  modifiers: ExperienceModifier[];
  endings: Record<string, string>;
  reality: string;
  authorTruth: AuthorTruth;
  crowdQuestion: string;
  authorChoiceId?: string;
  seededStats: CrowdStat[];
  communityReflections: CommunityReflection[];
  responsePrompt: string;
  themeKey: string;
  responseToPostId?: string;
  /** Everyone on stage. When absent, `npc` is adapted into a single actor. */
  actors?: RuntimeActor[];
  actorCues?: ActorCue[];
  keyObjects?: RuntimeKeyObject[];
  cinematic?: ScenarioCinematics;
  provenance?: ScenarioProvenance;
}

/** Believable demo comparison numbers for curated stories, explicitly tagged as seed data. */
function heroSeededStats(story: HeroStory, actions: Array<{ id: string; commitLabel: string }>): CrowdStat[] {
  const totalVotes = 1200 + Math.floor(Math.sin(story.id.length) * 400 + 400);
  const rawWeights = [0.44, 0.28, 0.18, 0.10, 0.08].slice(0, actions.length);
  const sumWeights = rawWeights.reduce((a, b) => a + b, 0);
  const percentages = rawWeights.map(w => Math.round((w / sumWeights) * 100));
  return actions.map((act, idx) => ({
    choiceId: act.id,
    label: act.commitLabel,
    percentage: percentages[idx] || 15,
    count: Math.round(totalVotes * ((percentages[idx] || 15) / 100)),
    source: 'seed_demo',
  }));
}

function heroReflections(story: HeroStory): CommunityReflection[] {
  const curated = story.curation?.reflections ?? [
    {
      id: 'ref_gen_1',
      authorHandle: '@thoughtful_human',
      authorName: 'Elena',
      text: 'Having to decide in real-time shows you who you really are under pressure.',
      timestamp: 'Yesterday',
      upvotes: 24,
    },
  ];
  return curated.map(r => ({ ...r, source: 'seed_demo' as const }));
}

/**
 * Maps a curated hero story to the canonical runtime format.
 *
 * Stories with a golden DSL fixture compile through the same Experience
 * Compiler as generated posts; their curated copy rides along as data. The
 * rest are adapted from their authored fields.
 */
export function compileHeroStoryToRuntime(story: HeroStory): CanonicalScenario {
  const authorHandle = `@demo_${story.id.replace(/-/g, '_')}`;
  const reflections = heroReflections(story);

  if (story.dsl) {
    const validation = validateDSL(story.dsl.dsl, { mode: 'model' });
    if (!validation.ok) {
      throw new Error(`Golden DSL fixture "${story.id}" is invalid: ${validation.errors.join('; ')}`);
    }
    const compiled = compileExperience(validation.dsl, {
      id: story.id,
      story: story.hook,
      author: story.author,
      authorHandle,
      truth: { status: 'fictional_demo', text: story.reality, sourceLabel: 'Заданная для демо развязка' },
      category: story.pillar,
      source: 'hero_fixture',
      lang: 'en',
      authorChoice: story.dsl.authorChoice,
      actionIds: story.dsl.actionIds,
      seededReflections: reflections,
      responsePrompt: 'Have you lived through a moment like this?',
      duration: story.duration,
      createdAt: 0,
    });
    return {
      ...compiled.scenario,
      hook: story.hook,
      setup: story.setup,
      synopsis: story.hook,
      seededStats: heroSeededStats(story, compiled.scenario.actions),
    };
  }

  // Infer semantic slots for hero actions if not already explicit
  const slotMap: Record<string, string> = {
    phone: 'phone_table',
    bathroom: 'bathroom_door',
    sofa: 'sofa',
    away: 'bedroom',
    intercom: 'intercom',
    peephole: 'front_door',
    window: 'window',
    interrupt: 'presentation_screen',
    laptop: 'player_laptop',
    director: 'director',
    wait: 'decision_center',
    friend: 'path',
    bench: 'bench',
    stop: 'bus_stop',
    quiet: 'decision_center',
    table: 'tables',
    exit: 'exit',
    envelope: 'street',
    stranger: 'car',
    document: 'documents',
    photo: 'photo',
    stairs: 'stair_door',
    hide: 'photo_wall',
    map: 'phone_screen',
    sister: 'phone_screen',
    door: 'front_door',
    person: 'platform_edge',
    board: 'station_board',
    train: 'train',
  };

  const runtimeActions: RuntimeAction[] = story.actions.map(action => {
    const targetSlot = slotMap[action.id] || action.id;
    const slotInfo = resolveSemanticSlot(story.world, targetSlot);
    return {
      id: action.id,
      targetSlot,
      slotInfo,
      label: action.label,
      observation: action.observation,
      commitLabel: action.commit,
    };
  });

  // Build event-driven beats from story cue & pressure timings
  const beats: StoryBeat[] = [
    { id: 'beat_arrival', type: 'arrival', trigger: 'time_elapsed', triggerPayload: 0, title: 'Arrival', description: story.openingLine },
    { id: 'beat_cue', type: 'cue', trigger: 'time_elapsed', triggerPayload: story.cueAtMs, title: 'The Cue', description: story.cue, isCue: true },
    { id: 'beat_pressure', type: 'pressure', trigger: 'time_elapsed', triggerPayload: story.pressureAtMs, title: 'Tension Escalation', description: story.pressure, isPressure: true },
    { id: 'beat_commitment', type: 'commitment', trigger: 'player_committed', title: 'Physical Commitment', description: 'The moment of decision' },
    { id: 'beat_reveal', type: 'reveal', trigger: 'previous_beat_complete', title: 'The Reality', description: story.reality },
  ];

  return {
    id: story.id,
    title: story.title,
    hook: story.hook,
    setup: story.setup,
    author: story.author,
    authorHandle,
    duration: story.duration,
    pillar: story.pillar,
    world: story.world,
    playerSpawn: WORLD_KNOWLEDGE[story.world]?.spawn ?? [38, 77],
    playerCharacter: 'young_adult_masc_01',
    timerAnchor: story.timerAnchor,
    shots: story.shots,
    authorTruth: {
      status: 'fictional_demo',
      text: story.reality,
      sourceLabel: 'Заданная для демо развязка',
    },
    npc: story.curation?.companion
      ? {
          id: 'partner_or_other',
          character: story.world === 'neighborhood_sunset' ? 'young_adult_masc_02' : 'adult_fem_01',
          slot: story.world === 'office_night' ? 'director' : story.world === 'hallway_night' ? 'elevator' : 'bathroom_door',
          initialPose: 'wait',
        }
      : undefined,
    actions: runtimeActions,
    beats,
    modifiers: story.modifiers,
    endings: story.endings,
    reality: story.reality,
    crowdQuestion: story.crowdQuestion,
    authorChoiceId: story.curation?.authorChoiceId ?? story.actions[0]?.id,
    seededStats: heroSeededStats(story, runtimeActions),
    communityReflections: reflections,
    responsePrompt: 'Have you lived through a moment like this?',
    themeKey: story.pillar,
    provenance: { dslVersion: 0, compilerVersion: 'legacy', source: 'legacy' },
  };
}

/**
 * Compiles a user-created or Gemini-generated GameSpec into a canonical Vivi scenario!
 */
export function compileGameSpecToRuntime(gameSpec: GameSpec): CanonicalScenario {
  const startNode = gameSpec.nodes[gameSpec.startNodeId] || Object.values(gameSpec.nodes)[0];
  const explicitTemplate = startNode?.worldConfig?.template as ViviWorldId | undefined;

  // Infer the best matching Vivi world
  let world: ViviWorldId = (explicitTemplate && worldTemplates[explicitTemplate]) ? explicitTemplate : 'apartment_night';

  if (!explicitTemplate || !worldTemplates[explicitTemplate]) {
    const titleLower = (gameSpec.title + ' ' + (gameSpec.description || '') + ' ' + (gameSpec.genre || '')).toLowerCase();
    if (titleLower.includes('meeting') || titleLower.includes('office') || titleLower.includes('work') || titleLower.includes('boss')) {
      world = 'office_night';
    } else if (titleLower.includes('door') || titleLower.includes('night') || titleLower.includes('intercom') || titleLower.includes('hallway') || titleLower.includes('stranger')) {
      world = 'hallway_night';
    } else if (titleLower.includes('friend') || titleLower.includes('walk') || titleLower.includes('park') || titleLower.includes('street')) {
      world = 'neighborhood_sunset';
    } else if (titleLower.includes('party') || titleLower.includes('bar') || titleLower.includes('club') || titleLower.includes('drinks')) {
      world = 'bar_or_party';
    } else if (titleLower.includes('train') || titleLower.includes('station') || titleLower.includes('metro')) {
      world = 'train_station';
    } else if (titleLower.includes('family') || titleLower.includes('parent') || titleLower.includes('home') || titleLower.includes('house')) {
      world = 'family_home';
    } else if (titleLower.includes('hotel') || titleLower.includes('rental') || titleLower.includes('trip')) {
      world = 'hotel_or_rental';
    } else if (titleLower.includes('bedroom') || titleLower.includes('bed') || titleLower.includes('sleep')) {
      world = 'bedroom_night';
    }
  }
  const choices = startNode?.choices || [];

  // Default slots based on world
  const fallbackSlots = ['decision_center', 'phone_table', 'front_door', 'window'];

  const runtimeActions: RuntimeAction[] = choices.map((c, idx) => {
    const slotId = fallbackSlots[idx % fallbackSlots.length];
    const slotInfo = resolveSemanticSlot(world, slotId);
    return {
      id: c.id,
      targetSlot: slotId,
      slotInfo,
      label: c.text.length > 28 ? c.text.slice(0, 26) + '…' : c.text,
      observation: `You hesitate by the ${slotInfo.label}, feeling the weight of the moment.`,
      commitLabel: c.text,
    };
  });

  if (runtimeActions.length === 0) {
    runtimeActions.push(
      {
        id: 'c1',
        targetSlot: 'decision_center',
        slotInfo: resolveSemanticSlot(world, 'decision_center'),
        label: 'Step forward',
        observation: 'You take a deep breath.',
        commitLabel: 'Speak your mind',
      },
      {
        id: 'c2',
        targetSlot: 'front_door',
        slotInfo: resolveSemanticSlot(world, 'front_door'),
        label: 'Step away',
        observation: 'You give yourself space.',
        commitLabel: 'Leave without speaking',
      }
    );
  }

  // Endings dictionary
  const endings: Record<string, string> = {};
  for (const act of runtimeActions) {
    const choiceNode = choices.find(ch => ch.id === act.id);
    const targetNode = choiceNode ? gameSpec.nodes[choiceNode.nextNodeId] : null;
    endings[act.id] = targetNode?.endingSummary || targetNode?.narrative || `You chose to ${act.commitLabel}. The consequences settle over the room.`;
  }

  const beats: StoryBeat[] = [
    {
      id: 'beat_arrival',
      type: 'arrival',
      trigger: 'time_elapsed',
      triggerPayload: 0,
      title: 'Arrival',
      description: startNode?.narrative || gameSpec.description || 'You find yourself at the center of the moment.',
    },
    {
      id: 'beat_cue',
      type: 'cue',
      trigger: 'time_elapsed',
      triggerPayload: 5000,
      title: 'The Cue',
      description: 'The situation demands an action.',
      isCue: true,
    },
    {
      id: 'beat_pressure',
      type: 'pressure',
      trigger: 'time_elapsed',
      triggerPayload: 16000,
      title: 'Tension',
      description: 'Time does not wait.',
      isPressure: true,
    },
    {
      id: 'beat_commit',
      type: 'commitment',
      trigger: 'player_committed',
      title: 'Decision',
      description: 'Commitment made.',
    },
  ];

  const rawTruth = gameSpec.whatReallyHappened;
  const hasAuthorTruth = typeof rawTruth === 'string' && rawTruth.trim().length > 5;
  const authorTruth: AuthorTruth = hasAuthorTruth
    ? { status: 'author_supplied', text: rawTruth.trim(), sourceLabel: 'со слов автора' }
    : { status: 'withheld' };

  const seededStats: CrowdStat[] = runtimeActions.map((act, i) => ({
    choiceId: act.id,
    label: act.commitLabel,
    percentage: i === 0 ? 56 : Math.round(44 / (runtimeActions.length - 1)),
    count: i === 0 ? 342 : 180,
    source: 'seed_demo',
  }));

  const authorHandle = `@${(gameSpec.author || 'creator').toLowerCase().replace(/\s+/g, '_')}`;

  return {
    id: gameSpec.id,
    title: gameSpec.title,
    hook: gameSpec.synopsis || (gameSpec.description ? gameSpec.description.slice(0, 120) + '…' : 'Enter what happened to me.'),
    setup: gameSpec.description || 'A real human situation.',
    author: gameSpec.author || 'Community Contributor',
    authorHandle,
    duration: gameSpec.estimatedPlaytime || '3 min',
    pillar: 'community',
    world,
    playerSpawn: [38, 77],
    playerCharacter: 'young_adult_masc_01',
    actions: runtimeActions,
    beats,
    modifiers: [
      { id: 'cue_mod', kind: 'timer', atMs: 5000, anchor: 'decision_center', payload: 'Decision time', visibleToPlayer: true },
    ],
    endings,
    reality: hasAuthorTruth ? rawTruth.trim() : '',
    authorTruth,
    crowdQuestion: 'What would you do?',
    seededStats,
    communityReflections: [
      {
        id: 'ref_1',
        authorHandle: '@reader_sample',
        authorName: 'Sample Reader',
        text: 'The hesitation before acting captures the moment well.',
        timestamp: 'Demo reflection',
        upvotes: 4,
        source: 'seed_demo',
      },
    ],
    responsePrompt: 'Did you experience something similar?',
    themeKey: 'experience',
  };
}
