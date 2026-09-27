import assert from 'node:assert/strict';
import { heroStories } from '../src/data/heroStories';
import {
  compileHeroStoryToRuntime,
  compileGameSpecToRuntime,
} from '../src/engine/runtime/RuntimeCompiler';
import { computePhysicalModifiers } from '../src/engine/runtime/ModifierEngine';
import { resolveMovement, isPointColliding, WORLD_COLLISIONS } from '../src/engine/runtime/collision';
import { resolveSemanticSlot } from '../src/engine/runtime/semanticSlots';

console.log('Testing Canonical Runtime & Physical Engine...');

// 1. Verify all 12 hero stories compile to CanonicalScenario
assert.equal(heroStories.length, 12, '12 hero stories exist');

for (const story of heroStories) {
  const scenario = compileHeroStoryToRuntime(story);
  assert.ok(scenario.id, `${story.id} has ID`);
  assert.ok(scenario.authorHandle.startsWith('@'), `${story.id} has author handle`);
  assert.ok(scenario.actions.length >= 3, `${story.id} has at least 3 actions`);
  assert.ok(scenario.seededStats.length === scenario.actions.length, `${story.id} has crowd stats for all actions`);
  assert.ok(scenario.communityReflections.length > 0, `${story.id} has community reflections`);

  // Verify all actions use semantic slots with valid coordinates
  for (const act of scenario.actions) {
    assert.ok(act.targetSlot, `${story.id} action ${act.id} has targetSlot`);
    assert.ok(act.slotInfo.anchorX >= 0 && act.slotInfo.anchorX <= 100, 'anchorX in bounds');
    assert.ok(act.slotInfo.standX >= 8 && act.slotInfo.standX <= 92, 'standX within walkable bounds');
    assert.ok(scenario.endings[act.id], `${story.id} action ${act.id} has ending text`);
  }
}
console.log('✓ All 12 hero stories compile to canonical scenarios with semantic slots');

// 2. Acceptance Test: The Message physical orchestration
const msgStory = heroStories.find(s => s.id === 'the-message')!;
const msgScenario = compileHeroStoryToRuntime(msgStory);

// At 0ms (arrival)
const mod0 = computePhysicalModifiers(msgScenario.modifiers, 0, 'the-message');
assert.equal(mod0.phone.isScreenLit, false, 'phone dark at start');
assert.equal(mod0.door.state, 'closed', 'door closed at start');

// At 5000ms (partner in bathroom, shower running)
const mod5s = computePhysicalModifiers(msgScenario.modifiers, 5000, 'the-message');
assert.equal(mod5s.ambientAudioCue, 'shower_water', 'shower water sounds active');
assert.equal(mod5s.npcAction.pose, 'leave', 'partner has moved to bathroom');

// At 8000ms (phone vibrates: "I still smell like you.")
const mod8s = computePhysicalModifiers(msgScenario.modifiers, 8000, 'the-message');
assert.equal(mod8s.phone.isScreenLit, true, 'phone screen is illuminated');
assert.equal(mod8s.phone.previewText, 'I still smell like you.', 'preview text is on phone');
assert.equal(mod8s.phone.isVibrating, true, 'phone is physically vibrating');

// At 32000ms (shower stops, handle moves)
const mod32s = computePhysicalModifiers(msgScenario.modifiers, 32000, 'the-message');
assert.equal(mod32s.door.state, 'handle_moving', 'bathroom door handle jiggles');
assert.equal(mod32s.timeDisplay.isExpiring, true, 'lock countdown expiring');
console.log('✓ The Message physical lifecycle test passed (shower, vibration, text, door)');

// 3. Acceptance Test: 03:17 physical orchestration
const mod0316 = computePhysicalModifiers([], 2000, '0317');
assert.equal(mod0316.timeDisplay.text, '03:16', '03:16 before cue');

const mod0317 = computePhysicalModifiers([], 8000, '0317');
assert.equal(mod0317.timeDisplay.text, '03:17', '03:17 when intercom buzzes');
assert.equal(mod0317.ambientAudioCue, 'intercom_ring', 'intercom ring audio cue');

// Elevator counting 6..7..8..9
const modElevator = computePhysicalModifiers([], 18000, '0317');
assert.ok(modElevator.elevator.indicatorText.includes('FL'), 'elevator floor indicator is active');

const modHandle = computePhysicalModifiers([], 26000, '0317');
assert.equal(modHandle.door.state, 'handle_moving', 'door handle moves after elevator reaches 9');
console.log('✓ 03:17 physical lifecycle test passed (clock, intercom, elevator, handle)');

// 4. Acceptance Test: Real Physical Collision & Sliding
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
console.log('✓ Physical collision and sliding resolution verified');

// 5. Acceptance Test: Generated Story in Canonical Engine
const mockGeneratedSpec = {
  id: 'gen_test_123',
  title: 'The Silent Slide',
  author: 'Marcus',
  synopsis: 'My coworker presented my research to the board.',
  description: 'In the boardroom, my slides were being shown without my name.',
  genre: 'Work',
  tags: ['work', 'betrayal'],
  startNodeId: 'node_start',
  nodes: {
    node_start: {
      id: 'node_start',
      title: 'Boardroom',
      narrative: 'The projector fan hums.',
      worldConfig: { template: 'office_night' },
      choices: [
        { id: 'c1', text: 'Stand up and claim authorship', nextNodeId: 'end_1' },
        { id: 'c2', text: 'Wait and email the board later', nextNodeId: 'end_2' },
      ],
    },
    end_1: { id: 'end_1', isEnding: true, endingSummary: 'You speak in the room.' },
    end_2: { id: 'end_2', isEnding: true, endingSummary: 'You send the drafts later.' },
  },
};

const compiledGen = compileGameSpecToRuntime(mockGeneratedSpec as any);
assert.equal(compiledGen.id, 'gen_test_123', 'id matches');
assert.equal(compiledGen.world, 'office_night', 'correctly maps to office_night');
assert.ok(compiledGen.actions.length === 2, '2 actions compiled');
assert.ok(compiledGen.actions[0].slotInfo.standX > 0, 'resolved semantic slot for action');
assert.equal(compiledGen.actions[0].commitLabel, 'Stand up and claim authorship');
assert.ok(compiledGen.communityReflections.length > 0, 'has community reflections');
console.log('✓ Generated story compiles into canonical runtime scenario');

console.log('\nALL CANONICAL RUNTIME TESTS PASSED SUCCESSFULLY!');
