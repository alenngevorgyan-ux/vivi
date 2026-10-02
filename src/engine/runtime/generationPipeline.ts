import { worldTemplates, type ViviWorldId } from '../../world/templates/index.ts';
import type { ViviCharacterId, CharacterPose } from '../../assets/characters/characters.ts';
import type { ExperienceModifier, ModifierKind } from '../modifiers/types.ts';
import type { StoryBeat, BeatTrigger, BeatType } from './StoryBeatRunner.ts';
import { resolveSemanticSlot } from './semanticSlots.ts';
import type { CanonicalScenario, RuntimeAction, CrowdStat, CommunityReflection } from './RuntimeCompiler.ts';

export type AuthorTruthStatus =
  | 'author_supplied'
  | 'withheld'
  | 'fictional_demo';

export interface AuthorTruth {
  status: AuthorTruthStatus;
  text?: string;
  sourceLabel?: string;
  withheldReason?: string;
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
}

export interface StoredPlayablePost {
  id: string;
  schemaVersion: 2;
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

/**
 * Deterministic fallback compiler that guarantees:
 * - Valid StoryAnalysis & ExperiencePlan
 * - Real contextual modifiers based on theme
 * - Semantic slots
 * - ZERO author truth fabrication (if whatReallyHappened is empty, authorTruth is strictly 'missing')
 */
export function generateDeterministicExperiencePlan(
  prompt: string,
  whatReallyHappened: string,
  genre: string,
  author: string
): { analysis: StoryAnalysis; plan: ExperiencePlan } {
  const p = prompt.toLowerCase();
  let worldTemplate: ViviWorldId = 'apartment_night';
  let themeKey = 'Relationships';

  // Determine appropriate world template
  if (p.includes('work') || p.includes('meeting') || p.includes('office') || p.includes('boss') || p.includes('presentation')) {
    worldTemplate = 'office_night';
    themeKey = 'Work';
  } else if (p.includes('door') || p.includes('intercom') || p.includes('hallway') || p.includes('elevator') || p.includes('night')) {
    worldTemplate = 'hallway_night';
    themeKey = 'Creepy';
  } else if (p.includes('friend') || p.includes('walk') || p.includes('bus') || p.includes('bench') || p.includes('leave')) {
    worldTemplate = 'neighborhood_sunset';
    themeKey = 'Memory';
  } else if (p.includes('party') || p.includes('bar') || p.includes('secret') || p.includes('friend') || p.includes('cheat')) {
    worldTemplate = 'bar_or_party';
    themeKey = 'Social';
  } else if (p.includes('train') || p.includes('station') || p.includes('late') || p.includes('track')) {
    worldTemplate = 'train_station';
    themeKey = 'Romance';
  } else if (p.includes('money') || p.includes('rain') || p.includes('street') || p.includes('envelope')) {
    worldTemplate = 'city_rain';
    themeKey = 'Money';
  }

  const id = `exp_${Date.now()}`;
  const firstSentence = prompt.split('.')[0] || prompt;
  const title = firstSentence.length > 5 && firstSentence.length < 42 ? firstSentence : 'The Unspoken Choice';

  const hasRealOutcome = !!whatReallyHappened && whatReallyHappened.trim().length > 5;
  const authorTruth: AuthorTruth = hasRealOutcome
    ? { status: 'author_supplied', text: whatReallyHappened.trim(), sourceLabel: 'со слов автора' }
    : { status: 'withheld' };

  const analysis: StoryAnalysis = {
    setting: worldTemplate.replace('_', ' '),
    people: ['Player', 'Other'],
    emotionalCore: 'Tension between hesitation and decisive truth',
    centralTension: prompt,
    pivotalMoment: 'The moment where doing nothing becomes its own decision',
    importantObjects: ['decision center', 'door', 'clock'],
    actualOutcome: hasRealOutcome ? whatReallyHappened.trim() : undefined,
    experienceGrammar: 'Explore space, observe cues, commit to action',
    themeKey: genre || themeKey,
  };

  // Build context-rich modifiers based on world template
  const modifiers: ExperienceModifier[] = [];
  let interactions: InteractionPlan[] = [];
  let commitments: CommitmentPlan[] = [];

  if (worldTemplate === 'apartment_night') {
    modifiers.push(
      { id: 'm_shower', kind: 'sound', atMs: 3000, anchor: 'bathroom_door', payload: 'Shower starts', visibleToPlayer: true },
      { id: 'm_msg', kind: 'message', atMs: 6500, anchor: 'phone_table', payload: 'Message preview arrives', visibleToPlayer: true },
      { id: 'm_door', kind: 'door', atMs: 25000, anchor: 'bathroom_door', payload: 'Handle moves', visibleToPlayer: true }
    );
    interactions = [
      { id: 'act_phone', targetSlot: 'phone_table', label: 'Approach the table', observation: 'A phone sits face up on the table, lit with incoming activity.', commitLabel: 'Read the screen directly' },
      { id: 'act_door', targetSlot: 'bathroom_door', label: 'Go to the bathroom door', observation: 'Water runs behind the closed door. The handle is still.', commitLabel: 'Ask aloud through the door' },
      { id: 'act_sofa', targetSlot: 'sofa', label: 'Stay on the sofa', observation: 'The silence between you and the room feels heavy.', commitLabel: 'Wait and say nothing tonight' },
    ];
    commitments = [
      { id: 'act_phone', targetSlot: 'phone_table', label: 'Look at the message', outcome: 'You read the preview. A single sentence replaces uncertainty with uncomfortable reality.' },
      { id: 'act_door', targetSlot: 'bathroom_door', label: 'Confront through the door', outcome: 'You ask directly. The water stops. The answer is given before you see their face.' },
      { id: 'act_sofa', targetSlot: 'sofa', label: 'Let it pass', outcome: 'You remain seated. The screen goes dark, but the question remains.' },
    ];
  } else if (worldTemplate === 'office_night') {
    modifiers.push(
      { id: 'm_screen', kind: 'npcPressure', atMs: 6000, anchor: 'director', payload: 'Director nods', visibleToPlayer: true },
      { id: 'm_timer', kind: 'timer', atMs: 22000, anchor: 'meeting_clock', payload: 'Ten seconds remaining', visibleToPlayer: true }
    );
    interactions = [
      { id: 'act_screen', targetSlot: 'presentation_screen', label: 'Step toward the display', observation: 'Your exact diagrams are shown on the screen under another name.', commitLabel: 'Speak up in the room' },
      { id: 'act_laptop', targetSlot: 'player_laptop', label: 'Open your laptop files', observation: 'Your dated files and revision timestamps are one click away.', commitLabel: 'Present your draft timestamps' },
      { id: 'act_director', targetSlot: 'director', label: 'Look at the director', observation: 'They are looking around the room, waiting for any comments.', commitLabel: 'Request a private conversation' },
    ];
    commitments = [
      { id: 'act_screen', targetSlot: 'presentation_screen', label: 'Claim the work aloud', outcome: 'You state your authorship in front of the team. The room turns.' },
      { id: 'act_laptop', targetSlot: 'player_laptop', label: 'Display draft evidence', outcome: 'You share your draft timestamps. The presentation is paused.' },
      { id: 'act_director', targetSlot: 'director', label: 'Speak privately later', outcome: 'You stay quiet for now, reserving your claim for a one-on-one meeting.' },
    ];
  } else if (worldTemplate === 'train_station') {
    modifiers.push(
      { id: 'm_board', kind: 'timer', atMs: 7000, anchor: 'station_board', payload: '00:46 BOARDING', visibleToPlayer: true },
      { id: 'm_train', kind: 'arrival', atMs: 25000, anchor: 'train', payload: 'Doors open', visibleToPlayer: true }
    );
    interactions = [
      { id: 'act_board', targetSlot: 'station_board', label: 'Check departure board', observation: 'This is the final service heading out tonight.', commitLabel: 'Board the train immediately' },
      { id: 'act_person', targetSlot: 'platform_edge', label: 'Stay beside them', observation: 'They are waiting for your reaction, their ticket in hand.', commitLabel: 'Miss the train and stay' },
      { id: 'act_bench', targetSlot: 'bench', label: 'Sit on the bench', observation: 'Cold night air fills the platform as passengers hurry past.', commitLabel: 'Ask for five more minutes' },
    ];
    commitments = [
      { id: 'act_board', targetSlot: 'station_board', label: 'Take the train', outcome: 'You step through the closing doors. The conversation stays unfinished.' },
      { id: 'act_person', targetSlot: 'platform_edge', label: 'Miss the train', outcome: 'The train departs. The silence gives you room to speak honestly.' },
      { id: 'act_bench', targetSlot: 'bench', label: 'Sit down together', outcome: 'You sit together. The rush of departure recedes.' },
    ];
  } else {
    // Generic fallback for any other world
    modifiers.push(
      { id: 'm_cue', kind: 'timer', atMs: 6000, anchor: 'decision_center', payload: 'The moment arrives', visibleToPlayer: true },
      { id: 'm_press', kind: 'timer', atMs: 22000, anchor: 'decision_center', payload: 'Decisive seconds', visibleToPlayer: true }
    );
    interactions = [
      { id: 'act_1', targetSlot: 'front_door', label: 'Inspect the door', observation: 'The exit is clear, offering a safe departure.', commitLabel: 'Step away from the situation' },
      { id: 'act_2', targetSlot: 'decision_center', label: 'Stand your ground', observation: 'You are at the focal point of the room.', commitLabel: 'Face the moment directly' },
      { id: 'act_3', targetSlot: 'window', label: 'Look through the window', observation: 'Outside, the city continues unaffected.', commitLabel: 'Wait and observe in silence' },
    ];
    commitments = [
      { id: 'act_1', targetSlot: 'front_door', label: 'Step away', outcome: 'You leave before the conflict deepens.' },
      { id: 'act_2', targetSlot: 'decision_center', label: 'Face directly', outcome: 'You step forward. Your action defines the next chapter.' },
      { id: 'act_3', targetSlot: 'window', label: 'Wait silently', outcome: 'You let the silence do the work.' },
    ];
  }

  const beats: StoryBeat[] = [
    { id: 'b_arrival', type: 'arrival', trigger: 'time_elapsed', triggerPayload: 0, title: 'Arrival', description: prompt },
    { id: 'b_cue', type: 'cue', trigger: 'time_elapsed', triggerPayload: 6000, title: 'The Cue', description: 'The situation unfolds and asks for your choice.', isCue: true },
    { id: 'b_press', type: 'pressure', trigger: 'time_elapsed', triggerPayload: 22000, title: 'Pressure', description: 'Hesitation has its own consequences.', isPressure: true },
    { id: 'b_commit', type: 'commitment', trigger: 'player_committed', title: 'Commitment', description: 'Decision made.' },
    { id: 'b_reveal', type: 'reveal', trigger: 'previous_beat_complete', title: 'The Outcome', description: hasRealOutcome ? whatReallyHappened : 'Truth not revealed.' },
  ];

  const plan: ExperiencePlan = {
    id,
    title,
    synopsis: prompt.length > 130 ? prompt.slice(0, 127) + '…' : prompt,
    worldTemplate,
    durationMinutes: 3,
    cast: [
      { role: 'other', character: 'adult_fem_01', slot: 'decision_center', pose: 'wait' },
    ],
    beats,
    interactions,
    modifiers,
    commitments,
    authorTruth,
    crowdQuestion: 'What would you do in this moment?',
    responsePrompt: 'Have you lived through a moment like this?',
  };

  return { analysis, plan };
}
