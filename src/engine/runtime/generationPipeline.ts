import { worldTemplates, type ViviWorldId } from '../../world/templates';
import type { ViviCharacterId, CharacterPose } from '../../assets/characters/characters';
import type { ExperienceModifier, ModifierKind } from '../modifiers/types';
import type { StoryBeat, BeatTrigger, BeatType } from './StoryBeatRunner';
import { resolveSemanticSlot } from './semanticSlots';
import type { CanonicalScenario, RuntimeAction, CrowdStat, CommunityReflection } from './RuntimeCompiler';

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

export interface AuthorTruth {
  status: 'verified' | 'missing';
  text?: string;
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

const VALID_MODIFIER_KINDS: Set<string> = new Set([
  'timer', 'message', 'typing', 'incoming_call', 'call',
  'door_state', 'door', 'sound', 'elevator', 'npc_move',
  'npc_dialogue', 'npcPressure', 'lighting', 'weather',
  'arrival', 'exit', 'crowd',
]);

const VALID_BEAT_TRIGGERS: Set<string> = new Set([
  'time_elapsed', 'player_entered_zone', 'object_inspected',
  'npc_reached_slot', 'dialogue_finished', 'modifier_finished',
  'player_committed', 'previous_beat_complete',
]);

/**
 * Validates an ExperiencePlan ensuring semantic correctness and safety.
 * Strictly rejects any raw x/y coordinates.
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
  const worldConfig = worldTemplates[worldId];
  const knownSlots = new Set(worldConfig ? worldConfig.slots.map(s => s.id) : []);
  // Common aliases allowed
  knownSlots.add('decision_center');
  knownSlots.add('phone_table');
  knownSlots.add('phone_screen');
  knownSlots.add('front_door');
  knownSlots.add('exit');

  // 2. Reject raw coordinates
  const jsonStr = JSON.stringify(input);
  if (jsonStr.includes('"x"') || jsonStr.includes('"y"') || jsonStr.includes('"coordinates"')) {
    errors.push('Raw x/y coordinates are strictly forbidden in ExperiencePlan. Use semantic slots only.');
  }

  // 3. Commitments count validation (2 to 5)
  if (!Array.isArray(input.commitments) || input.commitments.length < 2 || input.commitments.length > 5) {
    errors.push(`ExperiencePlan must have between 2 and 5 commitments (found ${input.commitments?.length || 0}).`);
  }

  // 4. Validate interactions
  if (!Array.isArray(input.interactions) || input.interactions.length < 2) {
    errors.push('ExperiencePlan must define at least 2 physical interactions.');
  } else {
    for (const inter of input.interactions) {
      if (!inter.targetSlot) {
        errors.push(`Interaction "${inter.id}" missing targetSlot.`);
      }
      if (!inter.label || inter.label.length > 45) {
        errors.push(`Interaction "${inter.id}" label must be between 1 and 45 characters.`);
      }
    }
  }

  // 5. Validate modifiers
  if (Array.isArray(input.modifiers)) {
    for (const mod of input.modifiers) {
      if (!VALID_MODIFIER_KINDS.has(mod.kind)) {
        errors.push(`Invalid modifier kind: "${mod.kind}".`);
      }
      if (typeof mod.atMs !== 'number' || mod.atMs < 0) {
        errors.push(`Modifier "${mod.id}" must have a non-negative atMs timing.`);
      }
    }
  }

  // 6. Validate author truth
  if (!input.authorTruth || typeof input.authorTruth !== 'object') {
    errors.push('ExperiencePlan must specify authorTruth with status "verified" or "missing".');
  } else {
    if (input.authorTruth.status === 'verified' && (!input.authorTruth.text || !input.authorTruth.text.trim())) {
      errors.push('AuthorTruth marked as verified but contains empty text.');
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
  author: string = 'Anonymous'
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

  // Seed honest demo stats
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
    };
  });

  const reflections: CommunityReflection[] = [
    {
      id: `ref_demo_${Date.now()}`,
      authorHandle: '@reader_sample',
      authorName: 'Sample Reader',
      text: 'The hesitation before deciding is captured so well here.',
      timestamp: 'Demo reflection',
      upvotes: 4,
    },
  ];

  const authorHandle = author.startsWith('@') ? author : `@${author.toLowerCase().replace(/\s+/g, '_')}`;

  return {
    id: plan.id,
    title: plan.title,
    hook: plan.synopsis,
    setup: analysis.centralTension || plan.synopsis,
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
    reality: plan.authorTruth.status === 'verified' ? plan.authorTruth.text || '' : '',
    crowdQuestion: plan.crowdQuestion || 'What would you do?',
    seededStats,
    communityReflections: reflections,
    responsePrompt: plan.responsePrompt || 'Have you lived through a moment like this?',
    themeKey: analysis.themeKey,
    authorTruth: plan.authorTruth,
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
    ? { status: 'verified', text: whatReallyHappened.trim() }
    : { status: 'missing' };

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
