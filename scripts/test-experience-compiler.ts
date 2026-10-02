import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { heroStories } from '../src/data/heroStories/index.ts';
import { HERO_DSL } from '../src/data/heroStories/dslFixtures.ts';
import { EVAL_CORPUS } from '../src/data/evalCorpus.ts';
import { HOLDOUT_CORPUS } from '../src/data/holdoutCorpus.ts';
import { validateDSL, serializeDSL, stripModelOnlyFields, type ViviExperienceDSL } from '../src/engine/compiler/dsl.ts';
import { compileExperience } from '../src/engine/compiler/ExperienceCompiler.ts';
import { compileViviStory, type CachedSemantics } from '../src/engine/compiler/compileViviStory.ts';
import type { ExperienceSemanticProvider } from '../src/engine/compiler/provider.ts';
import { MODEL_SYSTEM_PROMPT } from '../src/engine/compiler/modelContract.ts';
import { compileHeroStoryToRuntime, compileGameSpecToRuntime } from '../src/engine/runtime/RuntimeCompiler.ts';
import { isStoredPlayablePost, type StoredPlayablePost } from '../src/engine/runtime/generationPipeline.ts';
import { findPath, pathCollides, pathLength } from '../src/engine/runtime/navigation.ts';
import { actorFramesAt } from '../src/engine/runtime/actors.ts';
import { scenarioCast } from '../src/engine/runtime/scenarioActors.ts';
import { computePhysicalModifiers } from '../src/engine/runtime/ModifierEngine.ts';
import { StoryBeatRunner } from '../src/engine/runtime/StoryBeatRunner.ts';
import { directShot, OPENING_LOCK_MS } from '../src/engine/cinematic/director.ts';
import { DSL_VERSION, COMPILER_VERSION } from '../src/engine/compiler/vocabulary.ts';
import { resolvePlace, placeSlotExact } from '../src/engine/compiler/worldKnowledge.ts';
import { estimateTokens } from './lib/tokens.ts';

console.log('Testing Experience DSL & Compiler...\n');
let n = 0;
const ok = (label: string) => console.log(`✓ ${++n}. ${label}`);

const message = HERO_DSL['the-message'].dsl;
const base: ViviExperienceDSL = {
  v: 1, w: 'apt', g: 'betrayal', c: [['partner', 'on']], o: ['phone'],
  e: [['exit', 'partner', 'bathroom'], ['sound', 'shower'], ['msg', 'phone', 'Hi'], ['stop', 'shower']],
  a: [['read', 'phone', 'Read it'], ['ask', 'partner', 'Ask them'], ['wait', null, 'Wait']],
};

/* ------------------------------------------------------------- validation */

for (const [id, fixture] of Object.entries(HERO_DSL)) {
  const v = validateDSL(fixture.dsl);
  assert.ok(v.ok, `${id} golden DSL validates: ${!v.ok ? v.errors.join('; ') : ''}`);
  const compiled = compileExperience(v.dsl, { source: 'hero_fixture', story: id, createdAt: 0 });
  assert.equal(compiled.scenario.provenance?.dslVersion, DSL_VERSION, `${id} carries DSL version`);
  assert.equal(compiled.scenario.provenance?.compilerVersion, COMPILER_VERSION, `${id} carries compiler version`);
}
ok('Three golden DSL fixtures validate and compile with DSL + compiler version provenance');

assert.equal(validateDSL({ ...base, w: 'castle' }).ok, false, 'unknown world rejected');
assert.equal(validateDSL({ ...base, g: 'heist' }).ok, false, 'unknown grammar rejected');
assert.equal(validateDSL({ ...base, e: [['teleport', 'partner']] }).ok, false, 'unknown event rejected');
assert.equal(validateDSL({ ...base, a: [['dance', null, 'x'], ['wait', null, 'y']] }).ok, false, 'unknown verb rejected');
assert.equal(validateDSL({ ...base, c: [['butler', 'on']] }).ok, false, 'unknown role rejected');
// A role used without being declared is an omission, not an invention: the
// validator closes the cast (as it already does for objects) and the grounding
// layer decides whether the story supports that person at all.
{
  const undeclared = validateDSL({ ...base, e: [['say', 'boss', 'hello'], ['msg', 'phone', 'Hi']] });
  assert.ok(undeclared.ok, 'a role used in an event is declared rather than rejected');
  if (undeclared.ok) {
    assert.ok(undeclared.dsl.c.some(c => c[0] === 'boss' && c[1] === 'on'), 'someone who speaks is in the room');
    assert.ok(undeclared.warnings.some(w => /boss/.test(w)), 'the omission is recorded as a warning');
  }
  const remote = validateDSL({ ...base, a: [['read', 'phone', 'Read it'], ['call', 'boss', 'Call them']] });
  assert.ok(remote.ok && remote.dsl.c.some(c => c[0] === 'boss' && c[1] === 'off'), 'a role only acted on is reachable, not present');
}
// Every world answers every place word: a family home has a bedroom even
// though its template draws no bedroom slot, so a model is never wrong for
// naming one. The word lands on the nearest place of the same kind.
{
  const elsewhere = validateDSL({ ...base, e: [['exit', 'partner', 'platform']] });
  assert.ok(elsewhere.ok, 'a place the world does not draw still resolves');
  assert.equal(resolvePlace('family_home', 'bedroom'), 'stair_door', 'an unseen room is reached through the door');
  assert.equal(resolvePlace('apartment_night', 'bedroom'), 'bedroom', 'a world that draws the place still uses it');
  assert.equal(placeSlotExact('family_home', 'bedroom'), null, 'and the exact question still has an honest answer');
}
assert.equal(validateDSL({ ...base, notes: 'hi' }).ok, false, 'unknown top-level field rejected');
assert.equal(validateDSL({ ...base, a: [['read', 'phone', 'Read it']] }).ok, false, 'fewer than 2 commitments rejected');
assert.equal(
  validateDSL({ ...base, a: [...base.a, ['leave', null, 'a'], ['call_help', 'phone', 'b']] }).ok,
  false,
  'more than 4 commitments rejected'
);
ok('Invalid enums, unknown fields, dangling references and commitment counts are rejected');

const coords1 = validateDSL({ ...base, e: [['exit', 'partner', 76, 52]] });
const coords2 = validateDSL({ ...base, pos: [40, 70] });
const coords3 = validateDSL({ ...base, x: { ti: 'T', zoom: 1.4 } });
const coords4 = validateDSL({ ...base, a: [['read', { x: 54, y: 68 }, 'Read'], ['wait', null, 'W']] });
assert.equal(coords1.ok, false, 'numeric place rejected');
assert.equal(coords2.ok, false, 'pos rejected');
assert.equal(coords3.ok, false, 'zoom rejected');
assert.equal(coords4.ok, false, 'x/y target rejected');
assert.ok(!coords4.ok && coords4.errors.some(e => /Raw placement key/.test(e)), 'coordinates named as such in errors');
ok('Raw coordinates, zoom and placement keys are rejected, never converted');

/* ------------------------------------------------------------------ truth */

const lyingProvider = (dsl: object): ExperienceSemanticProvider => ({
  id: 'fake',
  compileStory: async () => ({ text: JSON.stringify(dsl), model: 'fake-model', usage: { inputTokens: 300, outputTokens: 120 } }),
});

const forged = { ...base, tr: 'author_supplied' };
assert.equal((stripModelOnlyFields(forged) as Record<string, unknown>).tr, undefined, 'model cannot carry tr');
const forgedResult = await compileViviStory({ story: 'My partner went into the shower.' }, { provider: lyingProvider(forged) });
assert.equal(forgedResult.report.source, 'model');
assert.equal(forgedResult.post.scenario.authorTruth.status, 'withheld', 'model claiming author_supplied stays withheld');
assert.equal(forgedResult.post.scenario.reality, '', 'no reality text without an author outcome');
assert.equal(forgedResult.compiled.dsl.tr, 'withheld', 'stamped provenance is the pipeline’s, not the model’s');
ok('Withheld truth cannot be fabricated or upgraded by model output');

const exact = '  I asked. They said it was nothing —  and I chose to believe them.  ';
const supplied = await compileViviStory({ story: 'My partner went into the shower.', actualOutcome: exact }, { provider: lyingProvider(base) });
assert.equal(supplied.post.scenario.authorTruth.status, 'author_supplied');
assert.equal(supplied.post.scenario.authorTruth.text, exact.trim(), 'author outcome preserved exactly (trimmed only)');
assert.equal(supplied.post.scenario.authorTruth.sourceLabel, 'со слов автора');
ok('author_supplied truth is preserved exactly');

for (const id of ['the-message', '0317', 'the-presentation']) {
  const scenario = compileHeroStoryToRuntime(heroStories.find(s => s.id === id)!);
  assert.equal(scenario.authorTruth.status, 'fictional_demo', `${id} is fictional_demo`);
  assert.equal(scenario.provenance?.source, 'hero_fixture', `${id} came from its golden fixture`);
}
ok('fictional_demo provenance preserved for curated stories');

const noRefs = compileExperience(validateDSL(base).ok ? (validateDSL(base) as { dsl: ViviExperienceDSL }).dsl : base, {
  source: 'manual',
  truth: { status: 'documented_source', text: 'A claim', sourceRefs: [] },
});
assert.equal(noRefs.scenario.authorTruth.status, 'withheld', 'documented_source without references is not enabled');
const withRefs = compileExperience(base, {
  source: 'manual',
  truth: { status: 'documented_source', text: 'Recorded in the archive.', sourceRefs: ['Archive ref 12/4'] },
});
assert.equal(withRefs.scenario.authorTruth.status, 'documented_source');
assert.deepEqual(withRefs.scenario.authorTruth.sourceRefs, ['Archive ref 12/4']);
assert.ok(!MODEL_SYSTEM_PROMPT.includes('documented'), 'models are never offered documented_source');
ok('documented_source is reserved: only with explicit source references, never from a model');

/* ---------------------------------------------------- multi-actor & routes */

const presentation = compileHeroStoryToRuntime(heroStories.find(s => s.id === 'the-presentation')!);
const presCast = scenarioCast(presentation);
assert.ok(presCast.actors.length >= 5, 'presenter, director and colleagues are all actors');
assert.equal(presCast.actors.filter(a => a.cls === 'background').length, 3, 'three background colleagues');
assert.ok(presCast.actors.some(a => a.role === 'coworker') && presCast.actors.some(a => a.role === 'boss'));
const atPraise = actorFramesAt(presCast.actors, presCast.cues, 7000, { world: 'office_night', playerPos: presentation.playerSpawn, obstacles: presCast.staticObstacles });
const boss = atPraise.find(f => f.id.startsWith('boss'))!;
assert.equal(boss.pose, 'talk', 'director speaks at the cue');
const colleaguesTurned = atPraise.filter(f => f.id.startsWith('colleague') && f.facing !== 'back');
assert.ok(colleaguesTurned.length >= 2, 'background colleagues turn toward the speaker');
const stare = computePhysicalModifiers(presentation.modifiers, 29000).stare;
const atStare = actorFramesAt(presCast.actors, presCast.cues, 29000, { world: 'office_night', playerPos: presentation.playerSpawn, obstacles: presCast.staticObstacles, stare });
assert.ok(stare, 'the room stares under pressure');
assert.ok(atStare.filter(f => f.id.startsWith('colleague')).every(f => f.facing === 'front' || f.facing === 'left'), 'colleagues look at the player');
const nearPlayer = actorFramesAt(presCast.actors, presCast.cues, 3000, { world: 'office_night', playerPos: [21, 62], obstacles: presCast.staticObstacles });
assert.ok(nearPlayer.find(f => f.id.endsWith('_0') && f.id.startsWith('colleague'))!.facing === 'left', 'a background colleague glances at a nearby player');
ok('Multi-actor scene compiles; background actors react to speech, stares and a nearby player');

// Straight across the coffee table must route around it.
const around = findPath('apartment_night', [56, 82], [56, 62]);
assert.ok(around.length > 2, 'route bends around the coffee table');
assert.equal(pathCollides('apartment_night', around), false, 'route never crosses the table');
const officeRoute = findPath('office_night', [30, 88], [72, 58]);
assert.equal(pathCollides('office_night', officeRoute), false, 'route never crosses the meeting table');
// The table spans the room: the shortest way round is ~94 units. Anything far beyond that is a zigzag.
assert.ok(pathLength(officeRoute) < 105, `route is not an absurd detour (${pathLength(officeRoute).toFixed(1)})`);
assert.ok(officeRoute.length <= 5, 'string-pulled into a few straight legs');
ok('NPC navigation routes around furniture without zigzags');

const msgScenario = compileHeroStoryToRuntime(heroStories.find(s => s.id === 'the-message')!);
const msgCast = scenarioCast(msgScenario);
const frame = (t: number) => actorFramesAt(msgCast.actors, msgCast.cues, t, { world: 'apartment_night', playerPos: msgScenario.playerSpawn })[0];
assert.equal(frame(0).presence, 1, 'partner present at the start');
assert.equal(frame(3200).pose, 'walk', 'partner walks to the bathroom');
assert.equal(frame(12000).presence, 0, 'partner is behind the door during the shower');
assert.equal(frame(39000).presence, 1, 'partner comes back through the door after the water stops');
const doorAt = (t: number) => computePhysicalModifiers(msgScenario.modifiers, t).door.state;
assert.equal(doorAt(31500), 'handle_moving', 'the handle moves after the shower stops');
assert.equal(doorAt(36500), 'open', 'the door opens');
assert.equal(computePhysicalModifiers(msgScenario.modifiers, 12000).bed, 'shower_water', 'the shower is a bed in the room');
assert.equal(computePhysicalModifiers(msgScenario.modifiers, 30500).bed, null, 'silence after the water stops');
ok('One semantic event expands into coordinated actor, door, sound and silence');

const echoDsl: ViviExperienceDSL = {
  v: 1, w: 'home', g: 'family', c: [['parent', 'off']], o: ['photo'],
  e: [['echo', 'photo'], ['sound', 'footsteps']],
  a: [['look', 'photo', 'Look at the photo'], ['leave', null, 'Leave it']],
};
const echoed = compileExperience(echoDsl, { source: 'manual', createdAt: 0 });
const photo = echoed.scenario.keyObjects!.find(k => k.id === 'photo')!;
assert.deepEqual(photo.echo?.characters, ['young_adult_masc_01', 'older_adult_01'], 'echo replays the player and the remembered person');
assert.ok(echoed.scenario.cinematic!.cameraEvents.some(e => e.kind === 'memory'), 'memory gets its own camera event');
assert.ok(echoed.scenario.modifiers.some(m => m.data?.glint === photo.slot), 'the object glints to invite approach');
assert.ok(echoed.scenario.beats.some(b => b.type === 'memoryEcho'), 'memory echo beat');
ok('MEMORY_ECHO: one word in the DSL becomes a glint, a camera beat and a replay at the object');

/* ---------------------------------------------------------------- camera */

const cin = msgScenario.cinematic!;
const shots = new Set<string>();
for (let t = 0; t < 40000; t += 250) {
  const s = directShot({ elapsedMs: t, revealed: false, committed: false, pressureTriggered: t > cin.pressureAtMs, grammar: cin.cameraGrammar, events: cin.cameraEvents, focusSlot: cin.focusSlot });
  if (t >= OPENING_LOCK_MS) assert.equal(s.locked, false, `no locked control at ${t}`);
  shots.add(s.shot);
}
for (const shot of ['ESTABLISHING_WIDE', 'TWO_SHOT', 'SLOW_PUSH_IN', 'STATIC_TENSION']) assert.ok(shots.has(shot), `uses ${shot}`);
assert.equal(directShot({ elapsedMs: 9000, revealed: false, committed: true, pressureTriggered: true, grammar: 'intimate' }).shot, 'FINAL_COMMIT');
assert.equal(directShot({ elapsedMs: 9000, revealed: true, committed: true, pressureTriggered: true, grammar: 'intimate' }).shot, 'REALITY_HOLD');
assert.equal(directShot({ elapsedMs: 9000, revealed: false, committed: false, pressureTriggered: false, grammar: 'intimate', insert: { slot: 'phone_table', atMs: 8500 } }).shot, 'OBJECT_INSERT');
ok('Camera grammar resolves into event-driven shots; control is never taken after the opening');

/* ------------------------------------------------------ generated scenes */

const generated = await compileViviStory({ story: 'My ex called me five minutes before the last train left and said they needed to tell me something before I left.' });
const g = generated.post.scenario;
assert.equal(g.world, 'train_station', 'train story stages a station');
assert.ok(g.cinematic && g.cinematic.cameraEvents.length >= 2, 'generated scene has camera events');
assert.ok((g.actors ?? []).length >= 1, 'generated scene has staged people');
assert.ok(g.modifiers.every(m => m.data), 'generated modifiers are structured, not text-interpreted');
assert.ok(g.keyObjects?.some(k => k.id === 'train') && g.keyObjects?.some(k => k.id === 'board'), 'departure board and train are key objects');
assert.ok(g.actions.some(a => a.slotInfo.carried), 'the caller is reached through the phone in your hand');
ok('Generated scene has shots, staging, semantic modifiers and story-specific objects');

const ru = await compileViviStory({ story: 'Муж ушёл в душ, а на его телефоне всплыло сообщение от незнакомого номера.' });
assert.ok(ru.post.scenario.actions.every(a => /[а-яё]/i.test(a.label)), 'derived labels follow the story language');
assert.ok(/[а-яё]/i.test(ru.post.scenario.crowdQuestion), 'crowd question in Russian');
ok('Language-neutral DSL; user-facing labels follow the story’s language');

const a1 = await compileViviStory({ story: EVAL_CORPUS[3].story }, { now: 1 });
const a2 = await compileViviStory({ story: EVAL_CORPUS[3].story }, { now: 1 });
assert.equal(JSON.stringify(a1.post), JSON.stringify(a2.post), 'same input → identical post');
ok('Compilation is deterministic (cacheable)');

/* ------------------------------------------------- provider & retry policy */

let calls = 0;
let repairs = 0;
const flaky: ExperienceSemanticProvider = {
  id: 'flaky',
  compileStory: async () => {
    calls++;
    return { text: JSON.stringify({ ...base, w: 'castle' }), model: 'flaky', usage: { outputTokens: 90 } };
  },
  repair: async (_r, invalid, errors) => {
    repairs++;
    assert.ok(invalid.includes('castle') && errors.some(e => e.includes('"w"')), 'repair receives only the invalid DSL and its errors');
    return { text: '```json\n' + JSON.stringify(base) + '\n```', model: 'flaky', usage: { outputTokens: 80 } };
  },
};
const repairedRun = await compileViviStory({ story: 'x story' }, { provider: flaky });
assert.equal(repairedRun.report.source, 'model');
assert.equal(repairedRun.report.repaired, true);
assert.equal(repairedRun.report.usage?.outputTokens, 170, 'usage summed across the repair');
assert.equal(calls, 1);
assert.equal(repairs, 1);

calls = 0;
repairs = 0;
const broken: ExperienceSemanticProvider = { ...flaky, repair: async () => (repairs++, { text: 'not json', model: 'flaky' }) };
const fallbackRun = await compileViviStory({ story: 'My manager asked me to take the blame in the meeting.' }, { provider: broken });
assert.equal(fallbackRun.report.source, 'deterministic', 'falls back after one failed repair');
assert.equal(repairs, 1, 'exactly one repair attempt');
assert.ok(fallbackRun.report.fallbackReason);

const throwing: ExperienceSemanticProvider = { id: 'down', compileStory: async () => { throw new Error('503'); } };
const downRun = await compileViviStory({ story: 'The elevator opened at 3 AM and nobody came out.' }, { provider: throwing });
assert.equal(downRun.report.source, 'deterministic');
assert.match(downRun.report.fallbackReason ?? '', /503/);

const cache = new Map<string, CachedSemantics>();
let cached = 0;
const counting: ExperienceSemanticProvider = { id: 'count', compileStory: async () => (cached++, { text: JSON.stringify(base), model: 'count' }) };
await compileViviStory({ story: 'Same   story.' }, { provider: counting, cache });
const hit = await compileViviStory({ story: 'same story.' }, { provider: counting, cache });
assert.equal(cached, 1, 'second identical story does not call the model');
assert.equal(hit.report.cacheHit, true);
ok('One repair at most, then deterministic fallback; provider errors fall back; semantics cache by normalised story');

/* ------------------------------------------------------- compatibility */

const legacyPost: StoredPlayablePost = {
  id: 'old_post', schemaVersion: 2, title: 'Old', author: 'Someone', synopsis: 'An old post', createdAt: 1,
  scenario: {
    ...compileHeroStoryToRuntime(heroStories.find(s => s.id === 'the-secret')!),
    id: 'old_post',
  },
};
const roundTrip = JSON.parse(JSON.stringify(legacyPost));
assert.ok(isStoredPlayablePost(roundTrip), 'legacy v2 post still recognised');
const legacyCast = scenarioCast(roundTrip.scenario);
assert.equal(legacyCast.actors.length, 1, 'legacy npc adapted into one actor');
assert.equal(roundTrip.scenario.actors, undefined, 'stored post was not rewritten');
const legacyFrames = actorFramesAt(legacyCast.actors, legacyCast.cues, 5000, { world: roundTrip.scenario.world, playerPos: roundTrip.scenario.playerSpawn });
assert.ok(legacyFrames[0].presence === 1, 'legacy companion is on stage');
const legacyGame = compileGameSpecToRuntime({
  id: 'g1', title: 'Old', description: 'office meeting', author: 'A', startNodeId: 'n',
  nodes: { n: { id: 'n', title: 'n', narrative: 'x', choices: [{ id: 'c1', text: 'One', nextNodeId: 'n' }, { id: 'c2', text: 'Two', nextNodeId: 'n' }] } },
} as never);
assert.equal(legacyGame.actions.length, 2, 'legacy GameSpec still compiles');
ok('Legacy StoredPlayablePost and GameSpec still load through the shared actor runtime');

const responded = await compileViviStory({ story: 'My sister called me before her wedding.', responseToPostId: 'parent_42' });
assert.equal(responded.post.responseToPostId, 'parent_42');
assert.equal(responded.post.scenario.responseToPostId, 'parent_42');
ok('responseToPostId survives the compiler');

const runner = new StoryBeatRunner(msgScenario.beats);
runner.checkTick(9000);
runner.onObjectInspected('phone_table', 'phone', 'obs');
runner.commitDecision('phone');
runner.reset();
assert.equal(runner.getState().committedChoiceId, null);
assert.equal(runner.getState().cueTriggered, false);
assert.deepEqual(frame(0).pos, msgCast.actors[0].spawn, 'actors are a pure function of time: restart returns them to their marks');
ok('Restart is clean: beat state resets and actors return to their marks');

/* ---------------------------------------------------------------- sizes */

const sizes: number[] = [];
for (const item of EVAL_CORPUS.filter(e => e.acceptance)) {
  const r = await compileViviStory({ story: item.story });
  sizes.push(estimateTokens(serializeDSL(r.compiled.dsl)));
}
assert.ok(Math.max(...sizes) < 500, `fallback DSL stays under 500 estimated tokens (max ${Math.max(...sizes)})`);
for (const [id, f] of Object.entries(HERO_DSL)) {
  assert.ok(estimateTokens(serializeDSL(f.dsl)) < 800, `${id} golden DSL under 800 estimated tokens`);
}
assert.ok(estimateTokens(MODEL_SYSTEM_PROMPT) < 1000, 'model system prompt stays under ~1000 tokens');
ok('DSL size budget holds (fallback < 500, curated golden < 800 estimated tokens; prompt < 1000)');

/* --------------------------------------------- semantic review of a scene */

const STORY_SHOWER = 'My partner went into the shower and a message from a stranger appeared on their phone.';
const STORY_KNOCK = 'Someone knocked on my door three times at 2:40 AM. The peephole showed an empty landing.';
const STORY_WEDDING = 'At the wedding everyone stared at me when I was asked to give a toast.';

/** A provider that answers with `first`, then with `second` if a repair is asked for. */
const scripted = (first: object, second?: object) => {
  const calls: string[][] = [];
  const provider: ExperienceSemanticProvider = {
    id: 'scripted',
    compileStory: async () => ({ text: JSON.stringify(first), model: 'scripted-model', usage: { inputTokens: 100, outputTokens: 50 } }),
    repair: async (_r, _json, errors) => {
      calls.push(errors);
      return { text: JSON.stringify(second ?? first), model: 'scripted-model', usage: { inputTokens: 40, outputTokens: 50 } };
    },
  };
  return { provider, calls };
};

const allObjects: ViviExperienceDSL = {
  v: 1, w: 'apt', g: 'betrayal', c: [['partner', 'on']], o: ['phone', 'letter'],
  e: [['msg', 'phone', 'Hi'], ['notice', 'letter'], ['stop', 'shower']],
  a: [['read', 'phone', 'Read the message', 'The screen is still lit.', 'You read it.'],
      ['look', 'letter', 'Look at the letter', 'It is face down.', 'You turn it over.'],
      ['open', 'letter', 'Open the letter', 'The flap is unsealed.', 'You open it.']],
};
const varied: ViviExperienceDSL = {
  ...allObjects,
  a: [['read', 'phone', 'Read the message', 'The screen is still lit.', 'You read it.'],
      ['ask', 'partner', 'Ask them about it', 'They are still in the doorway.', 'They stop and look at you.'],
      ['leave', null, 'Walk out', 'Your keys are by the door.', 'You step into the corridor.']],
};

{
  const { provider, calls } = scripted(allObjects, varied);
  const result = await compileViviStory({ story: STORY_SHOWER }, { provider });
  assert.equal(result.report.firstPassValid, true, 'an all-object scene is a legal program');
  assert.equal(result.report.firstPassClean, false, 'but it is not a situation');
  assert.equal(result.report.repaired, true, 'it costs exactly one repair turn');
  assert.equal(calls.length, 1, 'never more than one repair turn');
  assert.ok(calls[0].some(e => /same kind of thing/.test(e)), `repair message names the defect: ${calls[0].join(' | ')}`);
  assert.ok(calls[0].every(e => e.length < 240), 'repair messages stay compact');
  assert.deepEqual(result.compiled.dsl.a.map(a => a[0]), ['read', 'ask', 'leave'], 'the repaired scene is the one that is played');
  assert.equal(result.report.semanticErrors, undefined, 'nothing left to object to');
}
{
  const { provider, calls } = scripted(varied);
  const result = await compileViviStory({ story: STORY_SHOWER }, { provider });
  assert.equal(result.report.firstPassClean, true, 'object + person + way out passes first time');
  assert.equal(result.report.repaired, false);
  assert.equal(calls.length, 0, 'a real situation costs no repair');
}
ok('All-object choices cost one repair turn; object + person + way out passes first time');

{
  // One room, one object, nobody else: the scene may not be rejected for being small.
  const oneLocus: ViviExperienceDSL = {
    v: 1, w: 'hall', g: 'intrusion', c: [], o: ['door'],
    e: [['clock', '02:40'], ['sound', 'knock'], ['handle', 'front_door']],
    a: [['open', 'door', 'Open the door', 'The landing light is off.', 'The door swings in.'],
        ['wait', null, 'Stay perfectly still', 'Your hand is on the latch.', 'The knocking stops.']],
  };
  const { provider, calls } = scripted(oneLocus);
  const result = await compileViviStory({ story: STORY_KNOCK }, { provider });
  assert.equal(result.report.source, 'model', 'a story with one physical locus still plays');
  assert.equal(calls.length, 0, 'a legitimately confined story is not sent back');
  assert.equal(result.report.firstPassClean, true);
}
ok('A story that honestly offers one place is not rejected for being small');

/* ------------------------------------------------------- cast grounding */

{
  // "stranger" is a person standing in the room that the story never had.
  const invented: ViviExperienceDSL = {
    ...varied,
    c: [['partner', 'on'], ['stranger', 'on']],
    a: [['read', 'phone', 'Read the message', 'The screen is still lit.', 'You read it.'],
        ['confront', 'stranger', 'Confront them', 'They have not moved.', 'They meet your eye.'],
        ['leave', null, 'Walk out', 'Your keys are by the door.', 'You step into the corridor.']],
  };
  const { provider, calls } = scripted(invented, varied);
  const result = await compileViviStory({ story: STORY_SHOWER }, { provider });
  assert.ok(calls[0]?.some(e => /never mentions stranger/.test(e)), `grounding names the invented person: ${calls[0]?.join(' | ')}`);
  assert.ok(!result.compiled.dsl.c.some(c => c[0] === 'stranger'), 'the invented person is not in the played scene');
}
{
  // The same invented person, used by nothing: dropped for free, no repair turn.
  const spare: ViviExperienceDSL = { ...varied, c: [['partner', 'on'], ['host', 'on']] };
  const { provider, calls } = scripted(spare);
  const result = await compileViviStory({ story: STORY_SHOWER }, { provider });
  assert.equal(calls.length, 0, 'an unused invented role costs no model turn');
  assert.deepEqual(result.compiled.dsl.c, [['partner', 'on']], 'it is simply dropped');
  assert.ok(result.report.semanticNotes?.some(nt => /dropped host/.test(nt)), 'and the drop is recorded');
}
{
  // The repair turn has had its chance and kept the invented person: the
  // compiler takes them out rather than play a story the author never told.
  const stubborn: ViviExperienceDSL = {
    ...varied,
    c: [['partner', 'on'], ['stranger', 'on']],
    e: [['msg', 'phone', 'Hi'], ['say', 'stranger', 'I let myself in.'], ['stop', 'shower']],
    a: [['read', 'phone', 'Read the message', 'The screen is still lit.', 'You read it.'],
        ['confront', 'stranger', 'Confront them', 'They have not moved.', 'They meet your eye.'],
        ['leave', null, 'Walk out', 'Your keys are by the door.', 'You step into the corridor.']],
  };
  const { provider, calls } = scripted(stubborn);
  const result = await compileViviStory({ story: STORY_SHOWER }, { provider });
  assert.equal(calls.length, 1, 'the model is asked once');
  assert.ok(!result.compiled.dsl.c.some(c => c[0] === 'stranger'), 'then the person is removed');
  assert.ok(!result.compiled.dsl.e.some(e => e.includes('stranger')), 'with the events that needed them');
  assert.ok(!result.compiled.dsl.a.some(a => a[1] === 'stranger'), 'and the choices that needed them');
  assert.ok(result.compiled.dsl.e.length >= 1 && result.compiled.dsl.a.length >= 2, 'what is left is still a scene');
  assert.equal(validateDSL(result.compiled.dsl, { mode: 'stored' }).ok, true, 'and still a legal program');
  assert.equal(result.report.semanticErrors, undefined, 'nothing is left to object to');
}
{
  // A passer-by belongs where passers-by are. An office has no commuters.
  const outOfPlace: ViviExperienceDSL = {
    v: 1, w: 'office', g: 'credit', c: [['commuter', 'on']], o: ['screen'],
    e: [['say', 'commuter', 'Whose deck is this?'], ['stare', 'crowd']],
    a: [['speak_up', 'screen', 'Say it was yours', 'The deck is on the wall.', 'The room turns to you.'],
        ['wait', null, 'Say nothing at all', 'The clock is behind you.', 'The moment passes you by.']],
  };
  const { provider } = scripted(outOfPlace);
  const result = await compileViviStory({ story: 'During a meeting my coworker presented slides I had made as their own.' }, { provider });
  assert.ok(!result.compiled.dsl.c.some(c => c[0] === 'commuter'), 'a commuter is not implied by an office');
}
{
  // A wedding has guests. Populating a public room invents nobody.
  const crowd: ViviExperienceDSL = {
    v: 1, w: 'bar', g: 'scrutiny', c: [['guest', 'bg', 3]], o: ['phone'],
    e: [['sound', 'music'], ['stop', 'music'], ['stare', 'crowd']],
    a: [['speak_up', null, 'Give the toast', 'Every face is turned to you.', 'You lift the glass.'],
        ['read', 'phone', 'Check your phone', 'The notes app is still open.', 'You scroll for the name.'],
        ['leave', null, 'Walk out', 'The door is behind the band.', 'You put the glass down.']],
  };
  const { provider, calls } = scripted(crowd);
  const result = await compileViviStory({ story: STORY_WEDDING }, { provider });
  assert.equal(calls.length, 0, 'background guests in a public place are never questioned');
  assert.deepEqual(result.compiled.dsl.c, [['guest', 'bg', 3]], 'the crowd survives');
}
ok('An invented person on stage is refused or dropped; a public crowd is not');

/* ----------------------------------------------- deterministic staging */

{
  const crowded: ViviExperienceDSL = {
    v: 1, w: 'bar', g: 'message', c: [['friend', 'on']], o: ['phone', 'photo', 'document'],
    e: [['notice', 'photo'], ['msg', 'phone', 'Look at this'], ['stare', 'crowd']],
    a: [['read', 'photo', 'Look at the photo', 'It was taken tonight.', 'You study it.'],
        ['show', 'document', 'Show the printout', 'It is folded in your pocket.', 'You unfold it.'],
        ['open', 'phone', 'Open the thread', 'The chat is still open.', 'You scroll up.']],
  };
  assert.ok(validateDSL(crowded).ok, 'the crowded fixture is a legal program');
  const compiled = compileExperience(crowded, { source: 'model', createdAt: 0 });
  const spots = compiled.scenario.actions.filter(a => !a.slotInfo.carried && !a.actorId).map(a => [a.slotInfo.standX, a.slotInfo.standY] as const);
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      assert.ok(Math.hypot(spots[i][0] - spots[j][0], spots[i][1] - spots[j][1]) >= 3, 'every choice gets its own patch of floor');
    }
  }
  const cast = scenarioCast(compiled.scenario);
  for (const spot of spots) {
    const path = findPath(compiled.scenario.world, compiled.scenario.playerSpawn, [spot[0], spot[1]], { extra: cast.staticObstacles });
    const end = path[path.length - 1];
    assert.ok(Math.hypot(end[0] - spot[0], end[1] - spot[1]) <= 2, 'and the player can walk to it');
    assert.ok(!pathCollides(compiled.scenario.world, path, cast.staticObstacles), 'without crossing furniture');
  }
  assert.ok(compiled.scenario.cinematic!.cameraEvents.length > 0, 'the camera always has something to cut on');
  assert.ok(compiled.scenario.cinematic!.cueAtMs < compiled.scenario.cinematic!.pressureAtMs, 'pressure follows the cue');
}
{
  // Two people told to come in through the same door must not become one person.
  const sameDoor: ViviExperienceDSL = {
    v: 1, w: 'office', g: 'credit', c: [['boss', 'on'], ['coworker', 'on']], o: ['screen'],
    e: [['enter', 'boss', 'exit'], ['enter', 'coworker', 'exit'], ['say', 'boss', 'Whose slides are these?'], ['stare', 'crowd']],
    a: [['speak_up', 'screen', 'Say it was yours', 'The deck is still on the wall.', 'The room turns.'],
        ['ask', 'coworker', 'Ask them directly', 'They will not look up.', 'They shrug.'],
        ['wait', null, 'Say nothing', 'The clock is behind you.', 'The moment passes.']],
  };
  const compiled = compileExperience(sameDoor, { source: 'model', createdAt: 0 });
  const staged = scenarioCast(compiled.scenario).actors.filter(a => a.cls !== 'background');
  for (let i = 0; i < staged.length; i++) {
    for (let j = i + 1; j < staged.length; j++) {
      const d = Math.hypot(staged[i].spawn[0] - staged[j].spawn[0], staged[i].spawn[1] - staged[j].spawn[1]);
      assert.ok(d >= 3, `two people through one door stand apart (${d.toFixed(1)})`);
    }
  }
  const cast = scenarioCast(compiled.scenario);
  for (const cue of cast.cues.filter(c => c.act === 'enter' && c.then)) {
    const extra = cast.staticObstacles.filter(o => o.id !== `actor:${cue.actor}`);
    assert.ok(!pathCollides(compiled.scenario.world, findPath(compiled.scenario.world, cue.to!, cue.then!, { extra }), extra),
      `${cue.actor} walks in without crossing furniture`);
  }
}
ok('Standing spots are unique and reachable; people entering together stand apart');

/* ------------------------------------- a generated scene plays through */

{
  // The same chain the player walks: arrive, the cue lands, inspect a choice,
  // commit it, and the author's own words come back as the reveal.
  const outcome = 'I put the phone face down and said nothing.';
  const { provider } = scripted(varied);
  const played = await compileViviStory({ story: STORY_SHOWER, actualOutcome: outcome }, { provider });
  const scene = played.post.scenario;
  const runner = new StoryBeatRunner(scene.beats);
  const first = scene.actions[0];

  assert.equal(runner.getState().canCommit, false, 'no commitment before the cue');
  runner.checkTick(scene.cinematic!.cueAtMs + 500);
  assert.equal(runner.getState().cueTriggered, true, 'the cue lands on the compiled timeline');
  runner.onObjectInspected(first.targetSlot, first.id, first.observation);
  assert.equal(runner.getState().canCommit, true, 'a choice the player walked to can be taken');
  runner.commitDecision(first.id);
  assert.equal(runner.getState().committedChoiceId, first.id);
  runner.triggerReveal();
  assert.equal(runner.getState().currentBeat?.type, 'reveal', 'the reveal follows the commitment');
  assert.equal(runner.getState().currentBeat?.description, outcome, "and it is the author's own words");
  assert.ok(scene.endings[first.id], 'the choice has a consequence to show');

  runner.reset();
  assert.equal(runner.getState().committedChoiceId, null, 'and a reload starts clean');
}
ok('A generated scene plays through: cue, inspect, commit, reveal, reload');

/* ------------------------------------------------- no story-id branches */

const coreDirs = ['src/engine', 'src/components/world', 'src/assets/worlds', 'src/assets/characters'];
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
};
coreDirs.forEach(walk);
const holdoutIds = HOLDOUT_CORPUS.map(h => h.id);
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  assert.ok(!/['"](the-message|0317|the-presentation)['"]/.test(src), `${file} must not branch on a story id`);
  for (const id of holdoutIds) assert.ok(!src.includes(id), `${file} must not know about holdout story ${id}`);
}
ok(`No story-id branches in ${files.length} core engine files`);

console.log('\nALL EXPERIENCE COMPILER TESTS PASSED\n');
