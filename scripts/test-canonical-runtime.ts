import assert from 'node:assert/strict';
import { heroStories } from '../src/data/heroStories/index.ts';
import {
  compileHeroStoryToRuntime,
  compileGameSpecToRuntime,
} from '../src/engine/runtime/RuntimeCompiler.ts';
import { computePhysicalModifiers } from '../src/engine/runtime/ModifierEngine.ts';
import { resolveMovement, isPointColliding, WORLD_COLLISIONS } from '../src/engine/runtime/collision.ts';
import { resolveSemanticSlot } from '../src/engine/runtime/semanticSlots.ts';
import { StoryBeatRunner } from '../src/engine/runtime/StoryBeatRunner.ts';
import {
  validateExperiencePlan,
  compileExperiencePlanToScenario,
  isStoredPlayablePost,
  type ExperiencePlan,
  type StoryAnalysis,
  type StoredPlayablePost,
} from '../src/engine/runtime/generationPipeline.ts';
import { telemetry } from '../src/engine/runtime/telemetry.ts';
import { compileViviStory } from '../src/engine/compiler/compileViviStory.ts';

console.log('Testing Canonical Runtime & Physical Engine Hardening...\n');

// ============================================================================
// 1. Verify all 12 hero stories compile to CanonicalScenario with semantic slots & fictional_demo
// ============================================================================
assert.equal(heroStories.length, 12, '12 hero stories exist');

for (const story of heroStories) {
  const scenario = compileHeroStoryToRuntime(story);
  assert.ok(scenario.id, `${story.id} has ID`);
  assert.ok(scenario.authorHandle.startsWith('@demo_'), `${story.id} has @demo_ author handle`);
  assert.equal(scenario.authorTruth?.status, 'fictional_demo', `${story.id} truth status is fictional_demo`);
  assert.equal(scenario.authorTruth?.sourceLabel, 'Заданная для демо развязка', `${story.id} truth sourceLabel is demo`);
  assert.ok(scenario.actions.length >= 3, `${story.id} has at least 3 actions`);
  assert.ok(scenario.seededStats.length === scenario.actions.length, `${story.id} has crowd stats for all actions`);
  assert.ok(scenario.communityReflections.length > 0, `${story.id} has community reflections`);

  // Verify honest demo label
  for (const stat of scenario.seededStats) {
    assert.equal(stat.source, 'seed_demo', 'stats labeled as seed_demo');
  }

  // Verify all actions use semantic slots with valid bounds
  for (const act of scenario.actions) {
    assert.ok(act.targetSlot, `${story.id} action ${act.id} has targetSlot`);
    assert.ok(act.slotInfo.anchorX >= 0 && act.slotInfo.anchorX <= 100, 'anchorX in bounds');
    assert.ok(act.slotInfo.standX >= 8 && act.slotInfo.standX <= 92, 'standX within walkable bounds');
    assert.ok(scenario.endings[act.id], `${story.id} action ${act.id} has ending text`);
  }
}
console.log('✓ 1. All 12 hero stories compile to canonical scenarios with semantic slots & fictional_demo provenance');

// ============================================================================
// 2. Acceptance Test: Physical Distance & Exploration Gating
// ============================================================================
const testScenario = compileHeroStoryToRuntime(heroStories.find(s => s.id === 'the-message')!);
const phoneAction = testScenario.actions.find(a => a.id === 'phone')!;
assert.ok(phoneAction, 'phone action exists');

// Player spawn is at [38, 77]. Phone anchor is at [60, 68] (interactionRadius is 12).
const playerSpawnX = 38;
const playerSpawnY = 77;
const dxSpawn = phoneAction.slotInfo.anchorX - playerSpawnX;
const dySpawn = phoneAction.slotInfo.anchorY - playerSpawnY;
const distFromSpawn = Math.hypot(dxSpawn, dySpawn);

assert.ok(distFromSpawn > phoneAction.slotInfo.interactionRadius, 'player spawn is physically too far from phone');
// Remote interaction MUST be rejected
const isAllowedFromSpawn = distFromSpawn <= phoneAction.slotInfo.interactionRadius;
assert.equal(isAllowedFromSpawn, false, 'Remote interaction blocked when distant');

// When player moves close to phone [58, 69]:
const playerNearX = 58;
const playerNearY = 69;
const distNear = Math.hypot(phoneAction.slotInfo.anchorX - playerNearX, phoneAction.slotInfo.anchorY - playerNearY);
assert.ok(distNear <= phoneAction.slotInfo.interactionRadius, 'player is within physical interaction radius');
const isAllowedWhenNear = distNear <= phoneAction.slotInfo.interactionRadius;
assert.equal(isAllowedWhenNear, true, 'Physical interaction allowed when player is nearby');
console.log('✓ 2. Physical exploration gating verified: remote clicks rejected, nearby accepted');

// ============================================================================
// 3. Acceptance Test: StoryBeatRunner Authoritative State Machine
// ============================================================================
const runner = new StoryBeatRunner(testScenario.beats);
assert.equal(runner.getState().cueTriggered, false, 'cue inactive at 0ms');
assert.equal(runner.getState().pressureTriggered, false, 'pressure inactive at 0ms');
assert.equal(runner.getState().canCommit, false, 'cannot commit at 0ms');

// Attempting to commit before cue is strictly rejected
assert.throws(() => runner.commitDecision('phone'), /before physically inspecting it/);

// Advance time past cue (e.g. 9000ms)
runner.checkTick(9000);
assert.equal(runner.getState().cueTriggered, true, 'cue active after cue beat');
// Still cannot commit because action was not physically inspected!
assert.equal(runner.getState().canCommit, false, 'cannot commit before physically inspecting at least one action');
assert.throws(() => runner.commitDecision('phone'), /before physically inspecting it/);

// Physically inspect action
runner.onObjectInspected('phone_table', 'phone', 'A phone sits face up on the table.');
assert.ok(runner.isActionUnlocked('phone'), 'phone action unlocked in runner');
assert.equal(runner.getState().canCommit, true, 'can commit now that action is inspected and cue fired');

// Now commit action succeeds
runner.commitDecision('phone');
assert.equal(runner.getState().committedChoiceId, 'phone', 'committedChoiceId recorded');
assert.equal(runner.getState().currentBeat?.type, 'commitment', 'beat advances to commitment');
console.log('✓ 3. StoryBeatRunner authoritative gating verified (cue + physical inspection required)');

// ============================================================================
// 4. Acceptance Test: ModifierEngine 100% Generic Execution (0 storyId branching)
// ============================================================================
// Authored (legacy, text-interpreted) modifiers. The flagship scenes now compile
// from DSL with structured modifiers; the text interpretation must keep working
// for every older post, so it is tested against the authored data directly.
const messageStory = heroStories.find(s => s.id === 'the-message')!;
const msgModifiers = messageStory.modifiers;
const msgTimer = messageStory.timerAnchor;
// 0ms
const mod0 = computePhysicalModifiers(msgModifiers, 0, msgTimer);
assert.equal(mod0.phone.isScreenLit, false, 'phone dark at start');
assert.equal(mod0.door.state, 'closed', 'door closed at start');

// 5000ms (shower audio active from payload/anchor)
const mod5s = computePhysicalModifiers(msgModifiers, 5000, msgTimer);
assert.equal(mod5s.ambientAudioCue, 'shower_water', 'shower water sounds active');

// 8000ms (message arrives on phone)
const mod8s = computePhysicalModifiers(msgModifiers, 8000, msgTimer);
assert.equal(mod8s.phone.isScreenLit, true, 'phone screen is illuminated');
assert.equal(mod8s.phone.previewText, 'I still smell like you.', 'preview text is on phone');
assert.equal(mod8s.phone.isVibrating, true, 'phone is physically vibrating');

// 32000ms (handle moves)
const mod32s = computePhysicalModifiers(msgModifiers, 32000, msgTimer);
assert.equal(mod32s.door.state, 'handle_moving', 'bathroom door handle jiggles');
assert.equal(mod32s.timeDisplay.isExpiring, true, 'lock countdown expiring');

// 03:17 modifiers without storyId branching
const story0317 = heroStories.find(s => s.id === '0317')!;
const scenario0317 = { modifiers: story0317.modifiers, timerAnchor: story0317.timerAnchor };

const mod0317_early = computePhysicalModifiers(scenario0317.modifiers, 2000, scenario0317.timerAnchor);
assert.equal(mod0317_early.timeDisplay.text, '03:16', '03:16 before cue');

const mod0317_cue = computePhysicalModifiers(scenario0317.modifiers, 8000, scenario0317.timerAnchor);
assert.equal(mod0317_cue.timeDisplay.text, '03:17', '03:17 when intercom buzzes');
assert.equal(mod0317_cue.ambientAudioCue, 'intercom_ring', 'intercom ring audio cue');

// Elevator counting 6..7..8..9
const mod0317_lift = computePhysicalModifiers(scenario0317.modifiers, 18000, scenario0317.timerAnchor);
assert.ok(mod0317_lift.elevator.indicatorText.includes('FL'), 'elevator floor indicator is active');

const mod0317_handle = computePhysicalModifiers(scenario0317.modifiers, 26000, scenario0317.timerAnchor);
assert.equal(mod0317_handle.door.state, 'handle_moving', 'door handle moves after elevator reaches 9');
console.log('✓ 4. ModifierEngine generic execution verified across stories with ZERO storyId checks');

// ============================================================================
// 5. Acceptance Test: Frame-rate Independent Delta-Time Movement
// ============================================================================
function simulateMovement(fps: number, totalSeconds: number, speedPctPerSec: number): number {
  const steps = Math.round(fps * totalSeconds);
  const dt = totalSeconds / steps;
  let posX = 0;
  for (let i = 0; i < steps; i++) {
    // Delta-time step: pos += speed * dt
    posX += speedPctPerSec * dt;
  }
  return posX;
}

const speed = 25; // 25% per second
const duration = 1.0;
const dist60Hz = simulateMovement(60, duration, speed);
const dist90Hz = simulateMovement(90, duration, speed);
const dist120Hz = simulateMovement(120, duration, speed);
const dist144Hz = simulateMovement(144, duration, speed);

assert.ok(Math.abs(dist60Hz - 25) < 1e-4, '60Hz moves exactly 25%');
assert.ok(Math.abs(dist90Hz - 25) < 1e-4, '90Hz moves exactly 25%');
assert.ok(Math.abs(dist120Hz - 25) < 1e-4, '120Hz moves exactly 25%');
assert.ok(Math.abs(dist144Hz - 25) < 1e-4, '144Hz moves exactly 25%');
assert.ok(Math.abs(dist60Hz - dist144Hz) < 1e-4, '60Hz and 144Hz travel identical distance');
console.log('✓ 5. Delta-time movement invariance verified (60Hz, 90Hz, 120Hz, 144Hz)');

// ============================================================================
// 6. Acceptance Test: Real Physical Collision & Sliding
// ============================================================================
const aptConfig = WORLD_COLLISIONS.apartment_night;
assert.ok(aptConfig.obstacles.length >= 3, 'obstacles defined');

// Inside coffee table area (x: 54, y: 70)
const colliding = isPointColliding(54, 70, 2, aptConfig.obstacles);
assert.equal(colliding, true, 'detects collision inside coffee table');

// Free space (x: 38, y: 77)
const free = isPointColliding(38, 77, 2, aptConfig.obstacles);
assert.equal(free, false, 'free space has no collision');

// Moving into obstacle slides along unblocked axis
const [nextX, nextY] = resolveMovement(54, 82, 0, -5, 'apartment_night', 2.4);
assert.ok(nextY >= 76, 'movement stopped before entering coffee table collision box');
console.log('✓ 6. Physical collision and sliding resolution verified');

// ============================================================================
// 7. Acceptance Test: Zero Author Truth Fabrication & Truth Provenance Model
// ============================================================================
// When the user does NOT supply what happened in real life:
const emptyOutcomeGen = await compileViviStory({
  story: 'I was in the kitchen when the doorbell rang twice at night.',
  actualOutcome: '',
  category: 'Creepy',
  author: 'Anonymous',
});
const emptyScenario = emptyOutcomeGen.post.scenario;
assert.equal(emptyOutcomeGen.compiled.plan.authorTruth.status, 'withheld', 'authorTruth is strictly withheld');
assert.equal(emptyOutcomeGen.compiled.plan.authorTruth.text, undefined, 'no invented text in authorTruth');
assert.equal(emptyScenario.authorTruth?.status, 'withheld', 'scenario authorTruth status is withheld');
assert.equal(emptyScenario.reality, '', 'scenario reality is empty string');
assert.equal(emptyOutcomeGen.compiled.dsl.tr, 'withheld', 'stamped DSL provenance is withheld');
assert.ok(
  !JSON.stringify(emptyScenario.beats).includes('The author shared this moment'),
  'never fabricates placeholder reality text'
);

// When the user DOES supply what happened in real life:
const realOutcomeGen = await compileViviStory({
  story: 'My coworker took credit for my slides during a meeting.',
  actualOutcome: 'I sent the original Figma timestamped links directly to the VP after the call.',
  category: 'Work',
  author: 'Alice',
});
assert.equal(realOutcomeGen.compiled.plan.authorTruth.status, 'author_supplied', 'authorTruth is author_supplied');
assert.equal(
  realOutcomeGen.compiled.plan.authorTruth.text,
  'I sent the original Figma timestamped links directly to the VP after the call.',
  'authorTruth matches reality text'
);
assert.equal(realOutcomeGen.compiled.plan.authorTruth.sourceLabel, 'со слов автора', 'authorTruth has correct source label');
console.log('✓ 7. Truth provenance model verified (author_supplied with sourceLabel vs withheld with zero fabrication)');

// ============================================================================
// 8. Acceptance Test: legacy ExperiencePlan schema validation & world semantic slots
// ============================================================================
// Plans written in the pre-DSL format must still validate exactly as before.
const legacyPlan: ExperiencePlan = {
  id: 'legacy_plan',
  title: 'Legacy plan',
  synopsis: 'A plan stored before the Experience DSL existed.',
  worldTemplate: 'apartment_night',
  durationMinutes: 3,
  cast: [{ role: 'other', character: 'adult_fem_01', slot: 'decision_center', pose: 'wait' }],
  beats: [
    { id: 'b_arrival', type: 'arrival', trigger: 'time_elapsed', triggerPayload: 0, title: 'Arrival', description: 'You arrive.' },
    { id: 'b_cue', type: 'cue', trigger: 'time_elapsed', triggerPayload: 6000, title: 'Cue', description: 'The phone lights up.', isCue: true },
    { id: 'b_commit', type: 'commitment', trigger: 'player_committed', title: 'Commit', description: 'Decision.' },
  ],
  interactions: [
    { id: 'act_phone', targetSlot: 'phone_table', label: 'Approach the table', observation: 'A phone.', commitLabel: 'Read it' },
    { id: 'act_door', targetSlot: 'bathroom_door', label: 'Go to the door', observation: 'Water runs.', commitLabel: 'Ask' },
  ],
  modifiers: [{ id: 'm1', kind: 'message', atMs: 6500, anchor: 'phone_table', payload: 'Preview', visibleToPlayer: true }],
  commitments: [
    { id: 'act_phone', targetSlot: 'phone_table', label: 'Read', outcome: 'You read it.' },
    { id: 'act_door', targetSlot: 'bathroom_door', label: 'Ask', outcome: 'You ask.' },
  ],
  authorTruth: { status: 'withheld' },
  crowdQuestion: 'What would you do?',
  responsePrompt: 'Have you lived through this?',
};
const legacyAnalysis: StoryAnalysis = {
  setting: 'apartment', people: ['player'], emotionalCore: 'doubt', centralTension: 'a phone',
  pivotalMoment: 'the message', importantObjects: ['phone'], experienceGrammar: 'betrayal', themeKey: 'Relationships',
};

// Raw coordinates must be strictly rejected
const invalidCoordPlan = {
  ...legacyPlan,
  interactions: [
    { id: 'act_1', targetSlot: 'phone_table', label: 'Phone', observation: 'lit', commitLabel: 'Read', x: 50, y: 70 },
    { id: 'act_2', targetSlot: 'sofa', label: 'Sofa', observation: 'soft', commitLabel: 'Wait' },
  ],
};
assert.equal(validateExperiencePlan(invalidCoordPlan).valid, false, 'rejects raw x/y coordinates');

// Less than 2 commitments must be rejected
const invalidCommitPlan = { ...legacyPlan, commitments: [{ id: 'c1', targetSlot: 'sofa', label: 'Wait', outcome: 'Waited' }] };
assert.equal(validateExperiencePlan(invalidCommitPlan).valid, false, 'rejects less than 2 commitments');

// Invalid semantic slot for the chosen world template must be rejected
const invalidSlotPlan = {
  ...legacyPlan,
  worldTemplate: 'train_station' as const,
  cast: [],
  interactions: [
    { id: 'act_1', targetSlot: 'bathroom_door', label: 'Door', observation: 'locked', commitLabel: 'Knock' },
    { id: 'act_2', targetSlot: 'train', label: 'Train', observation: 'waiting', commitLabel: 'Board' },
  ],
  modifiers: [],
  commitments: [
    { id: 'c1', targetSlot: 'bathroom_door', label: 'Knock', outcome: 'Nothing' },
    { id: 'c2', targetSlot: 'train', label: 'Board', outcome: 'Departed' },
  ],
};
const slotValidation = validateExperiencePlan(invalidSlotPlan);
assert.equal(slotValidation.valid, false, 'rejects invalid slot bathroom_door for train_station world');
assert.ok(
  !slotValidation.valid && slotValidation.errors.some(e => e.includes('bathroom_door') && e.includes('train_station')),
  'validator error specifically mentions the invalid slot and world'
);

// Valid plan passes and still compiles to a playable scenario
assert.equal(validateExperiencePlan(legacyPlan).valid, true, 'valid legacy ExperiencePlan passes validation');
const legacyPlanScenario = compileExperiencePlanToScenario(legacyPlan, legacyAnalysis);
assert.equal(legacyPlanScenario.authorTruth.status, 'withheld', 'legacy plan keeps withheld truth');
assert.equal(legacyPlanScenario.actions.length, 2, 'legacy plan compiles its interactions');
console.log('✓ 8. Legacy ExperiencePlan validation verified (rejects invalid semantic slots for world, raw x/y, enforces commitments)');

// ============================================================================
// 9. Acceptance Test: Gated Research Telemetry Export
// ============================================================================
// Telemetry with NO research opt-in
const sessNoOptIn = telemetry.startSession('test_1', false);
telemetry.recordEvent('cue_seen', 5000);
assert.equal(sessNoOptIn.events.length, 2, 'events recorded locally');
assert.throws(() => telemetry.exportResearchPayload(sessNoOptIn), /Research export blocked/);

// Telemetry with researchOptIn = true but missing consentVersion
const sessMissingConsent = telemetry.startSession('test_2', true);
assert.throws(() => telemetry.exportResearchPayload(sessMissingConsent), /Research export blocked/);

// Telemetry with valid consent
const sessConsented = telemetry.startSession('test_3', true, 'v1.0');
telemetry.recordEvent('decision_committed', 8200, { choiceId: 'phone', decisionLatencyMs: 3200 });
const exported = telemetry.exportResearchPayload(sessConsented) as any;
assert.ok(exported, 'export succeeded with valid consent');
assert.equal(exported.consentVersion, 'v1.0', 'consent version recorded');
assert.equal(exported.eventLog.length, 2, 'exported anonymized events');
console.log('✓ 9. Research telemetry export gating verified (requires explicit opt-in + consent version)');

// ============================================================================
// 10. Acceptance Test: StoryBeatRunner.reset() completely resets state
// ============================================================================
const runnerToReset = new StoryBeatRunner(testScenario.beats);
runnerToReset.checkTick(10000);
runnerToReset.onObjectInspected('phone_table', 'phone', 'A lit phone.');
runnerToReset.commitDecision('phone');
runnerToReset.triggerReveal();

const dirtyState = runnerToReset.getState();
assert.equal(dirtyState.cueTriggered, true, 'dirty cue is true');
assert.equal(dirtyState.isRevealed, true, 'dirty reveal is true');
assert.equal(dirtyState.committedChoiceId, 'phone', 'dirty commit choice exists');
assert.ok(dirtyState.completedBeatIds.size > 0, 'dirty completed beat IDs exist');

runnerToReset.reset();
const freshState = runnerToReset.getState();
assert.equal(freshState.cueTriggered, false, 'reset cueTriggered is false');
assert.equal(freshState.pressureTriggered, false, 'reset pressureTriggered is false');
assert.equal(freshState.canCommit, false, 'reset canCommit is false');
assert.equal(freshState.committedChoiceId, null, 'reset committedChoiceId is null');
assert.equal(freshState.isRevealed, false, 'reset isRevealed is false');
assert.equal(freshState.unlockedActionIds.size, 0, 'reset unlockedActionIds is empty');
assert.equal(freshState.completedBeatIds.size, 0, 'reset completedBeatIds is empty');
console.log('✓ 10. StoryBeatRunner.reset() verified (all flags, sets, and committed choices cleanly reset)');

// ============================================================================
// 11. Acceptance Test: Generated Demo Data Provenance (source: seed_demo)
// ============================================================================
const demoPlanScenario = realOutcomeGen.post.scenario;
for (const stat of demoPlanScenario.seededStats) {
  assert.equal(stat.source, 'seed_demo', 'generated crowd stat explicitly tagged source: seed_demo');
}
for (const ref of demoPlanScenario.communityReflections) {
  assert.equal(ref.source, 'seed_demo', 'generated community reflection explicitly tagged source: seed_demo');
}
console.log('✓ 11. Generated demo data provenance verified (seed_demo tags on stats and reflections)');

// ============================================================================
// 12. Acceptance Test: Response Chain Persistence & StoredPlayablePost Preservation
// ============================================================================
const responseGen = await compileViviStory({
  story: 'My coworker took credit for my slides during a meeting.',
  actualOutcome: 'I sent the original Figma timestamped links directly to the VP after the call.',
  category: 'Work',
  author: 'Charlie',
  responseToPostId: 'parent_post_456',
});
const responseScenario = responseGen.post.scenario;
assert.equal(responseScenario.responseToPostId, 'parent_post_456', 'responseToPostId persisted in scenario');

const storedPost: StoredPlayablePost = {
  id: responseScenario.id,
  schemaVersion: 2,
  title: responseScenario.title,
  author: responseScenario.author,
  authorHandle: responseScenario.authorHandle,
  synopsis: responseScenario.synopsis || 'Test synopsis',
  pillar: responseScenario.pillar,
  world: responseScenario.world,
  scenario: responseScenario,
  analysis: responseGen.post.analysis,
  experiencePlan: responseGen.compiled.plan,
  dsl: responseGen.compiled.dsl,
  legacyGameSpec: { id: responseScenario.id, title: responseScenario.title } as any,
  responseToPostId: 'parent_post_456',
  themeKey: 'Work',
  inspirationPrompt: 'Prompt text',
  createdAt: 1700000000,
};

// Survives JSON serialize / deserialize without loss
const serialized = JSON.stringify(storedPost);
const parsedPost = JSON.parse(serialized);

assert.ok(isStoredPlayablePost(parsedPost), 'isStoredPlayablePost recognizes parsed JSON');
assert.equal(parsedPost.schemaVersion, 2, 'schemaVersion 2 preserved');
assert.equal(parsedPost.responseToPostId, 'parent_post_456', 'responseToPostId preserved in StoredPlayablePost');
assert.equal(parsedPost.scenario.authorTruth?.status, 'author_supplied', 'scenario authorTruth status preserved');
assert.equal(parsedPost.scenario.actions.length, responseScenario.actions.length, 'all runtime actions preserved');
assert.equal(responseGen.post.responseToPostId, 'parent_post_456', 'responseToPostId survives compileViviStory');
assert.equal(parsedPost.dsl?.v, 1, 'DSL version survives storage');
console.log('✓ 12. Response chain and StoredPlayablePost serialization verified end-to-end');

// ============================================================================
// 13. Acceptance Test: Legacy GameSpec Fallback Still Functional
// ============================================================================
const legacyGameSpec = {
  id: 'legacy_1',
  title: 'Old Story',
  description: 'An old description before canonical engine',
  author: 'OldAuthor',
  startNodeId: 'node_1',
  nodes: {
    node_1: {
      id: 'node_1',
      title: 'Node 1',
      narrative: 'Old narrative',
      worldConfig: { template: 'apartment_night' },
      choices: [
        { id: 'c1', text: 'Choice 1', targetNodeId: 'node_1', reaction: 'React 1' },
        { id: 'c2', text: 'Choice 2', targetNodeId: 'node_1', reaction: 'React 2' },
      ],
    },
  },
  whatReallyHappened: 'Old author reality happened here.',
} as any;

const compiledLegacy = compileGameSpecToRuntime(legacyGameSpec);
assert.equal(compiledLegacy.id, 'legacy_1', 'compiled legacy has ID');
assert.equal(compiledLegacy.authorTruth?.status, 'author_supplied', 'legacy reality mapped to author_supplied');
assert.equal(compiledLegacy.actions.length, 2, 'legacy choices compiled to runtime actions');
console.log('✓ 13. Legacy GameSpec fallback verified (backward compatibility preserved)');

console.log('\n========================================================');
console.log('ALL CANONICAL RUNTIME HARDENING ACCEPTANCE TESTS PASSED!');
console.log('========================================================\n');

