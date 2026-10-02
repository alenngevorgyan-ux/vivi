import type { HeroStory, HeroAction } from '../../data/heroStories';
import type { GameSpec } from '../../types/gameSpec';
import { worldTemplates, type ViviWorldId } from '../../world/templates';
import type { ExperienceModifier } from '../modifiers/types';
import type { ViviCharacterId } from '../../assets/characters/characters';
import { resolveSemanticSlot, type SemanticSlotResolution } from './semanticSlots.ts';
import { StoryBeat } from './StoryBeatRunner.ts';
import type { AuthorTruth, AuthorTruthStatus } from './generationPipeline.ts';
export type { AuthorTruth, AuthorTruthStatus };

export interface RuntimeAction {
  id: string;
  targetSlot: string;
  slotInfo: SemanticSlotResolution;
  label: string;
  observation: string;
  commitLabel: string;
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
}

// Maps authored hero stories or generated stories to canonical runtime format
export function compileHeroStoryToRuntime(story: HeroStory): CanonicalScenario {
  // Infer semantic slots for hero actions if not already explicit
  const slotMap: Record<string, string> = {
    // the-message
    phone: 'phone_table',
    bathroom: 'bathroom_door',
    sofa: 'sofa',
    away: 'bedroom',

    // 0317
    intercom: 'intercom',
    peephole: 'front_door',
    window: 'window',

    // the-presentation
    interrupt: 'presentation_screen',
    laptop: 'player_laptop',
    director: 'director',
    wait: 'decision_center',

    // last-walk
    friend: 'path',
    bench: 'bench',
    stop: 'bus_stop',
    quiet: 'decision_center',

    // generic
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
    {
      id: 'beat_arrival',
      type: 'arrival',
      trigger: 'time_elapsed',
      triggerPayload: 0,
      title: 'Arrival',
      description: story.openingLine,
    },
    {
      id: 'beat_cue',
      type: 'cue',
      trigger: 'time_elapsed',
      triggerPayload: story.cueAtMs,
      title: 'The Cue',
      description: story.cue,
      isCue: true,
    },
    {
      id: 'beat_pressure',
      type: 'pressure',
      trigger: 'time_elapsed',
      triggerPayload: story.pressureAtMs,
      title: 'Tension Escalation',
      description: story.pressure,
      isPressure: true,
    },
    {
      id: 'beat_commitment',
      type: 'commitment',
      trigger: 'player_committed',
      title: 'Physical Commitment',
      description: 'The moment of decision',
    },
    {
      id: 'beat_reveal',
      type: 'reveal',
      trigger: 'previous_beat_complete',
      title: 'The Reality',
      description: story.reality,
    },
  ];

  // Seed realistic community comparison stats
  const totalVotes = 1200 + Math.floor(Math.sin(story.id.length) * 400 + 400);
  const actionCount = story.actions.length;
  // Distribute percentages believable for human moral dilemmas
  const rawWeights = [0.44, 0.28, 0.18, 0.10, 0.08].slice(0, actionCount);
  const sumWeights = rawWeights.reduce((a, b) => a + b, 0);
  const percentages = rawWeights.map(w => Math.round((w / sumWeights) * 100));

  // Determine which choice the author took based on reality
  let authorChoiceId = story.actions[0]?.id;
  if (story.id === 'the-message') authorChoiceId = 'bathroom'; // author asked directly
  if (story.id === '0317') authorChoiceId = 'window'; // stayed inside
  if (story.id === 'the-presentation') authorChoiceId = 'wait'; // sent files later
  if (story.id === 'last-walk') authorChoiceId = 'quiet'; // hugged in silence

  const seededStats: CrowdStat[] = story.actions.map((act, idx) => ({
    choiceId: act.id,
    label: act.commit,
    percentage: percentages[idx] || 15,
    count: Math.round(totalVotes * ((percentages[idx] || 15) / 100)),
    source: 'seed_demo',
  }));

  // Seed realistic reflections
  const reflections = getSeededReflections(story.id, story.author).map(r => ({
    ...r,
    source: 'seed_demo' as const,
  }));

  const authorHandle = `@demo_${story.id.replace(/-/g, '_')}`;

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
    playerSpawn: [38, 77],
    playerCharacter: 'young_adult_masc_01',
    timerAnchor: story.timerAnchor,
    authorTruth: {
      status: 'fictional_demo',
      text: story.reality,
      sourceLabel: 'Заданная для демо развязка',
    },
    npc: {
      id: 'partner_or_other',
      character: story.world === 'neighborhood_sunset' ? 'young_adult_masc_02' : 'adult_fem_01',
      slot: story.world === 'office_night' ? 'director' : story.world === 'hallway_night' ? 'elevator' : 'bathroom_door',
      initialPose: 'wait',
    },
    actions: runtimeActions,
    beats,
    modifiers: story.modifiers,
    endings: story.endings,
    reality: story.reality,
    crowdQuestion: story.crowdQuestion,
    authorChoiceId,
    seededStats,
    communityReflections: reflections,
    responsePrompt: 'Have you lived through a moment like this?',
    themeKey: story.pillar,
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

function getSeededReflections(storyId: string, author: string): CommunityReflection[] {
  if (storyId === 'the-message') {
    return [
      {
        id: 'ref_msg_1',
        authorHandle: author.toLowerCase().includes('alex') ? '@alex_k' : '@author_verified',
        authorName: 'Author Note',
        text: 'Looking back, what hurt most wasn’t the notification itself, but how instantly trust felt like glass. We stayed together for another year, but that silence while the shower ran never really left me.',
        timestamp: 'Pinned by author',
        isAuthorResponse: true,
        upvotes: 142,
      },
      {
        id: 'ref_msg_2',
        authorHandle: '@clara_m',
        authorName: 'Clara',
        choiceLabel: 'Open the message',
        text: 'I voted to look. Everyone says trust until it’s your gut screaming at 11 PM. You can’t unsee it, but living in doubt is worse.',
        timestamp: '3 hours ago',
        upvotes: 56,
      },
      {
        id: 'ref_msg_3',
        authorHandle: '@mark_d',
        authorName: 'Mark',
        choiceLabel: 'Ask them directly',
        text: 'Knocking on the bathroom door is the only way to retain your own dignity. If they lie, that’s on them.',
        timestamp: '5 hours ago',
        upvotes: 38,
      },
    ];
  }

  if (storyId === '0317') {
    return [
      {
        id: 'ref_0317_1',
        authorHandle: '@author_verified',
        authorName: 'Author Note',
        text: 'I didn’t sleep normally for two weeks after this. The sound of the elevator counting up was the scariest part.',
        timestamp: 'Pinned by author',
        isAuthorResponse: true,
        upvotes: 89,
      },
      {
        id: 'ref_0317_2',
        authorHandle: '@night_owl_99',
        authorName: 'Viktor',
        choiceLabel: 'Stay inside and call for help',
        text: 'Never open a door at 3 AM. No curiosity is worth that risk.',
        timestamp: '1 day ago',
        upvotes: 67,
      },
    ];
  }

  return [
    {
      id: 'ref_gen_1',
      authorHandle: '@thoughtful_human',
      authorName: 'Elena',
      text: 'Having to decide in real-time shows you who you really are under pressure.',
      timestamp: 'Yesterday',
      upvotes: 24,
    },
  ];
}
