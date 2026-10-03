import assert from 'node:assert/strict';
import { EXPERIENCE_FIXTURES, experienceFixtureById } from '../src/data/experienceFixtures/index.ts';
import { compileFixture, createReplayProvider } from '../src/data/experienceFixtures/replay.ts';
import { HERO_DSL } from '../src/data/heroStories/dslFixtures.ts';
import { heroStories } from '../src/data/heroStories/index.ts';
import { SOCIAL_MEMORIES } from '../src/data/socialMemories.ts';
import { compileViviStory } from '../src/engine/compiler/compileViviStory.ts';
import { validateDSL } from '../src/engine/compiler/dsl.ts';
import { compileExperience } from '../src/engine/compiler/ExperienceCompiler.ts';
import type { ExperienceSemanticProvider, SemanticRequest } from '../src/engine/compiler/provider.ts';
import { boundaryAt, findFactRef, hasFirstPerson, proposeBoundary, splitSentences } from '../src/engine/experience/boundary.ts';
import { persistChoice, readChoice, sceneKey, type StorageLike } from '../src/engine/experience/choiceStore.ts';
import { ui } from '../src/engine/experience/copy.ts';
import { enactmentScript, recipeFor } from '../src/engine/experience/enactment.ts';
import { availability, resolveApproach } from '../src/engine/experience/interaction.ts';
import { initialExperienceState, run, step } from '../src/engine/experience/machine.ts';
import { experienceFor, sealForPlayback } from '../src/engine/experience/playback.ts';
import { assessFormat } from '../src/engine/experience/situation.ts';
import { compileGameSpecToRuntime, compileHeroStoryToRuntime } from '../src/engine/runtime/RuntimeCompiler.ts';
import { isStoredPlayablePost } from '../src/engine/runtime/generationPipeline.ts';
import { findPath, isWalkable, pathCollides } from '../src/engine/runtime/navigation.ts';
import { computePhysicalModifiers } from '../src/engine/runtime/ModifierEngine.ts';
import type { CollisionBox } from '../src/engine/runtime/collision.ts';

/**
 * Experience V2 regression tests.
 *
 * Inputs here are written independently of the implementation: stories,
 * geometry and event sequences a reviewer can read and check by hand. The
 * assertions are about what a player or an author would observe — where the
 * hero ends up, what is persisted, what text appears, what leaves the
 * process — not about the helpers agreeing with themselves.
 */

console.log('Testing Experience V2...\n');
let n = 0;
const ok = (label: string) => console.log(`✓ ${++n}. ${label}`);

/* ------------------------------------------------------- interaction --- */

{
  // Far corner of the apartment to the far side of the coffee table: the sofa
  // and the table are between them. The hero must walk, around furniture.
  const from: [number, number] = [12, 88];
  const r = resolveApproach({ world: 'apartment_night', from, anchor: [80, 62], stand: [80, 66] });
  assert.equal(r.mode, 'walk', `distant valid target resolves to a walk, got ${r.mode}`);
  const end = r.path![r.path!.length - 1];
  assert.ok(Math.hypot(end[0] - 80, end[1] - 66) <= 2, 'the walk ends at the standing spot');
  assert.equal(pathCollides('apartment_night', r.path!), false, 'the walk never crosses furniture');
  assert.ok(!r.diagnostics.some(d => /too far/i.test(d)), 'distance is never a reason');

  // Already standing there: performed in place, no walk.
  const here = resolveApproach({ world: 'apartment_night', from: [80, 66], anchor: [80, 62], stand: [80.5, 66] });
  assert.equal(here.mode, 'in_place');
  // A phone already in hand: in place regardless of distance.
  assert.equal(resolveApproach({ world: 'apartment_night', from, anchor: [90, 50], inPlace: true }).mode, 'in_place');
}
ok('A distant, valid target is reached by walking a collision-free route; nothing says "too far"');

{
  // The authored spot sits inside the coffee table: recovery picks a nearby reachable spot.
  const blocked = resolveApproach({ world: 'apartment_night', from: [20, 60], anchor: [56, 71], stand: [56, 71] });
  assert.equal(blocked.mode, 'walk');
  assert.ok(isWalkable('apartment_night', blocked.stand!), 'recovered spot is standable');
  assert.ok(blocked.diagnostics.some(d => /authored spot/.test(d)), 'the recovery is recorded as a diagnostic');

  // A walled-off pocket: standable inside, but no route in. The engine cuts instead of refusing.
  const walls: CollisionBox[] = [
    { id: 'w1', name: 'w', x1: 60, y1: 50, x2: 92, y2: 53, blocksMovement: true },
    { id: 'w2', name: 'w', x1: 60, y1: 50, x2: 63, y2: 66, blocksMovement: true },
    { id: 'w3', name: 'w', x1: 60, y1: 63, x2: 92, y2: 66, blocksMovement: true },
  ];
  const pocket = resolveApproach({ world: 'apartment_night', from: [20, 60], anchor: [75, 58], stand: [75, 58], obstacles: walls });
  assert.equal(pocket.mode, 'cut', `an enclosed spot becomes a cut, got ${pocket.mode}`);

  // Nowhere to stand at all: performed as text.
  const everything: CollisionBox[] = [{ id: 'all', name: 'all', x1: 0, y1: 0, x2: 100, y2: 100, blocksMovement: true }];
  const none = resolveApproach({ world: 'apartment_night', from: [20, 60], anchor: [75, 58], stand: [75, 58], obstacles: everything });
  assert.equal(none.mode, 'text');
}
ok('Unreachable targets recover: another spot, then a cut, then text — never a refusal');

{
  // Meaning can refuse where distance cannot: a person who left is not conjured.
  assert.deepEqual(availability({ actorId: 'boss' }, { actorPresence: { boss: 0 }, reachableThroughDoor: new Set() }), { ok: false, reason: 'person_absent' });
  assert.deepEqual(availability({ actorId: 'partner' }, { actorPresence: { partner: 0 }, reachableThroughDoor: new Set(['partner']) }), { ok: true, throughDoor: true });
  assert.deepEqual(availability({}, { actorPresence: {}, reachableThroughDoor: new Set() }), { ok: true });
}
ok('An absent person is unavailable; one behind a door is addressed through it');

/* -------------------------------------------------------- the machine --- */

{
  // Look, then change your mind before arriving.
  const t = run([{ type: 'ORIENTED' }, { type: 'LOOK', id: 'look_0' }, { type: 'CANCEL' }]);
  assert.equal(t.state.phase, 'exploring');
  assert.ok(t.effects.some(e => e.type === 'stop_approach'), 'cancelling stops the walk');
  assert.ok(!t.effects.some(e => e.type === 'persist_choice'), 'nothing is persisted');

  // Pick a deed, then step back with Escape.
  const p = run([{ type: 'ORIENTED' }, { type: 'PICK', id: 'read_phone' }, { type: 'CANCEL' }]);
  assert.equal(p.state.pendingId, undefined);
  assert.equal(p.state.committedId, undefined);

  // Switch target mid-walk.
  const s = run([{ type: 'ORIENTED' }, { type: 'LOOK', id: 'look_0' }, { type: 'LOOK', id: 'look_1' }]);
  assert.equal(s.state.observationId, 'look_1');
  assert.ok(s.effects.filter(e => e.type === 'stop_approach').length === 1, 'the first walk is stopped');
}
ok('Before a commitment, any approach or pending deed can be cancelled or retargeted');

{
  const t = run([
    { type: 'ORIENTED' },
    { type: 'LOOK', id: 'look_0' },
    { type: 'ARRIVED', id: 'look_0' },
    { type: 'CLOSE_OBSERVATION' },
    { type: 'LOOK', id: 'look_1' },
    { type: 'ARRIVED', id: 'look_1' },
  ]);
  assert.equal(t.state.phase, 'observing');
  assert.equal(t.state.committedId, undefined);
  assert.deepEqual(t.state.seen, ['look_0', 'look_1']);
  assert.ok(!t.effects.some(e => e.type === 'persist_choice' || e.type === 'enact'), 'looking never commits');
}
ok('Observations never commit and never start an enactment');

{
  const t = run([
    { type: 'ORIENTED' },
    { type: 'PICK', id: 'a' },
    { type: 'COMMIT', id: 'a' },
    { type: 'COMMIT', id: 'b' },
    { type: 'PICK', id: 'b' },
    { type: 'LOOK', id: 'look_0' },
    { type: 'CANCEL' },
  ]);
  assert.equal(t.state.committedId, 'a');
  assert.equal(t.effects.filter(e => e.type === 'persist_choice').length, 1, 'a choice is persisted exactly once');
  assert.equal(t.effects.filter(e => e.type === 'enact').length, 1);
  assert.equal(t.state.phase, 'enacting', 'nothing after a commitment can cancel or redirect it');

  // Nothing can be committed during the mandatory orientation.
  const early = run([{ type: 'COMMIT', id: 'a' }]);
  assert.equal(early.state.committedId, undefined);
}
ok('A commitment locks once; later commits, picks, looks and cancels are ignored');

{
  const committed = run([{ type: 'ORIENTED' }, { type: 'COMMIT', id: 'a' }]).state;
  // The reveal cannot jump ahead of the deed.
  assert.equal(step(committed, { type: 'BOUNDARY_DONE' }).state.phase, 'enacting');
  assert.equal(step(committed, { type: 'PAUSED' }).state.phase, 'enacting');
  const full = run([{ type: 'ENACTED' }, { type: 'PAUSED' }, { type: 'BOUNDARY_DONE' }], committed);
  assert.equal(full.state.phase, 'revealed');
  // Skipping the performance is a correct end to it; skipping before any deed reveals nothing.
  assert.equal(step(committed, { type: 'SKIP' }).state.phase, 'revealed');
  const exploring = run([{ type: 'ORIENTED' }]).state;
  assert.equal(step(exploring, { type: 'SKIP' }).state.phase, 'exploring');
  // A replay is a new run.
  assert.equal(step(full.state, { type: 'RESTART' }).state.run, 1);
}
ok('Reveal order: commit → enactment → pause → boundary → reveal; only a skip of the deed shortcuts it');

/* ------------------------------------------------------- persistence --- */

{
  const memory = new Map<string, string>();
  const storage: StorageLike = { getItem: k => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
  const key = sceneKey('post1', '1.1.0', ['read_phone', 'wait', 'ask_partner']);
  persistChoice(storage, key, 'read_phone', 'attempt-1', 1);
  persistChoice(storage, key, 'read_phone', 'attempt-1', 2); // the same commit persisted twice
  let rec = readChoice(storage, key)!;
  assert.equal(rec.firstChoiceId, 'read_phone');
  assert.equal(rec.replays.length, 0, 'idempotent');
  persistChoice(storage, key, 'wait', 'attempt-2', 3);
  rec = readChoice(storage, key)!;
  assert.equal(rec.firstChoiceId, 'read_phone', 'a replay never rewrites the first choice');
  assert.deepEqual(rec.replays.map(r => r.choiceId), ['wait']);
  const otherVersion = sceneKey('post1', '1.2.0', ['read_phone', 'wait']);
  assert.equal(readChoice(storage, otherVersion), undefined, 'a different scene version is a different record');
}
ok('First choice is recorded once per scene version; replays are kept apart');

/* ------------------------------------------------------- the fixtures --- */

const compiled = new Map<string, Awaited<ReturnType<typeof compileFixture>>>();
for (const f of EXPERIENCE_FIXTURES) compiled.set(f.id, await compileFixture(f));

{
  for (const f of EXPERIENCE_FIXTURES) {
    const r = compiled.get(f.id)!;
    const x = r.post.scenario.experience!;
    assert.equal(r.report.source, 'model', `${f.id} plays the stored program, not a fallback`);
    assert.equal(x.format, f.expectedFormat, `${f.id} routes to ${f.expectedFormat}, got ${x.format} (${x.missing.join(', ')})`);
    if (f.expectedFormat !== 'playable') continue;
    assert.equal(r.report.semanticErrors, undefined, `${f.id} has no unresolved semantic objection`);
    assert.deepEqual(
      x.commitments.map(c => [c.label, c.meaning, c.enactment]),
      f.commitments.map(c => [c.label, c.meaning, c.enactment]),
      `${f.id} offers exactly the reviewed deeds`
    );
    assert.ok(new Set(x.commitments.map(c => c.meaning)).size >= 2, `${f.id} deeds differ in meaning`);
    assert.ok(x.observations.length >= 1 && x.observations.every(o => o.sourced), `${f.id} observations come from the story`);
    assert.ok(x.whyHard?.text, `${f.id} says why it is hard`);
  }
}
ok('Editorial fixtures play through the production pipeline and offer the reviewed deeds');

{
  for (const f of EXPERIENCE_FIXTURES.filter(f => f.expectedFormat === 'playable')) {
    const scenario = compiled.get(f.id)!.post.scenario;
    // Every spoken line and every on-screen message is the author's own text.
    for (const m of scenario.modifiers) {
      const said = (m.data as { speech?: string; screenText?: string } | undefined)?.speech ?? (m.data as { screenText?: string } | undefined)?.screenText;
      if (said) assert.ok(findFactRef(said, f.source, 0.6), `${f.id}: "${said}" is in the story`);
      assert.ok(!(m.data as { lockSec?: number } | undefined)?.lockSec, `${f.id}: no invented lock countdown`);
      assert.ok(m.kind !== 'crowd', `${f.id}: no invented stares`);
    }
    // Nobody enters who the story did not put there; the scene never stops a shower the story left running.
    assert.ok(!scenario.modifiers.some(m => m.payload === 'Water stops' || (m.data as { bed?: string | null } | undefined)?.bed === null), `${f.id}: no invented silence`);
    assert.ok(!(scenario.actorCues ?? []).some(c => c.act === 'enter'), `${f.id}: nobody arrives`);
  }
}
ok('Staging adds no lines, messages, timers, stares, arrivals or silences the story does not give');

{
  for (const f of EXPERIENCE_FIXTURES.filter(f => f.expectedFormat === 'playable')) {
    const x = compiled.get(f.id)!.post.scenario.experience!;
    for (const c of x.commitments) {
      const script = enactmentScript(c, key => ui(f.lang, key));
      const allowed = new Set([c.label, ...(c.shows ? [c.shows] : []), ...(script.note ? [script.note] : [])]);
      for (const line of [script.caption, script.shows, script.note].filter(Boolean)) assert.ok(allowed.has(line!), `${f.id}/${c.id}: unexpected text`);
      if (c.shows) assert.ok(f.source.includes(c.shows), `${f.id}/${c.id}: shown content is quoted in the story`);
      // An address, a public claim or a call ends on the hero's words: the note says no reply is part of the story.
      if (['address_person', 'speak_up', 'use_device'].includes(c.enactment)) assert.equal(script.note, ui(f.lang, 'noReply'));
      assert.ok(!('actor' in script.recipe), 'a recipe moves only the hero');
    }
  }
  // "Open the message" shows only the preview the story quotes.
  const read = compiled.get('v2-apartment-ru')!.post.scenario.experience!.commitments.find(c => c.verb === 'read')!;
  assert.equal(read.shows, 'Ты уже сказала ему?');
  assert.equal(enactmentScript(read, k => ui('ru', k)).note, ui('ru', 'unknownContent'));
}
ok('After a commitment the scene shows only the chosen deed — no generated reply or reaction');

{
  // Once committed, the runtime's own state at the end of the scene contains no speech that was not in the story.
  const scenario = compiled.get('v2-office-ru')!.post.scenario;
  for (let t = 0; t <= 60000; t += 500) {
    const s = computePhysicalModifiers(scenario.modifiers, t, scenario.timerAnchor);
    if (s.npcAction.speakingLine) assert.ok(experienceFixtureById['v2-office-ru'].source.includes(s.npcAction.speakingLine.replace(/\.$/, '')), 'only quoted lines are ever spoken');
  }
}
ok('Over a whole scene, the only lines anyone speaks are the ones the author quoted');

/* ------------------------------------------------- truth boundaries --- */

{
  const ACT = 'CANARY-ACT-7f3a';
  const WHY = 'CANARY-WHY-91c2';
  const AFTER = 'CANARY-AFTER-4d0e';
  const ENDING = 'В итоге я позвонил брату CANARY-ENDING-5b1.';
  const seen: string[] = [];
  const capture: ExperienceSemanticProvider = {
    id: 'capture',
    async compileStory(request: SemanticRequest) {
      seen.push(JSON.stringify(request));
      return { text: '{"v":1,"w":"apt"}', model: 'capture' }; // invalid on purpose: forces the repair turn
    },
    async repair(request: SemanticRequest, invalid: string, errors: string[]) {
      seen.push(JSON.stringify({ request, invalid, errors }));
      return { text: JSON.stringify(experienceFixtureById['v2-apartment-ru'].dsl), model: 'capture' };
    },
  };
  const story = `${experienceFixtureById['v2-apartment-ru'].source} ${ENDING}`;
  const result = await compileViviStory({ story, actualOutcome: ACT, authorWhy: WHY, authorAfter: AFTER }, { provider: capture });
  assert.equal(seen.length, 2, 'first pass and repair were both called');
  for (const body of seen) {
    for (const canary of [ACT, WHY, AFTER, 'CANARY-ENDING']) assert.ok(!body.includes(canary), `${canary} never reaches the provider`);
  }
  assert.equal(result.post.scenario.authorTruth.text, ACT, 'the author act is preserved exactly');
  assert.equal(result.post.scenario.authorTruth.why, WHY);
  assert.equal(result.post.scenario.authorTruth.after, AFTER);
  assert.ok(!result.post.synopsis.includes('CANARY'), 'the pre-reveal synopsis holds no ending');
  assert.ok(!(result.post.inspirationPrompt ?? '').includes('CANARY'), 'the stored prompt holds no ending');
  assert.equal(result.post.scenario.experience?.boundary.mode, 'auto_split');

  // A confirmed split is honoured exactly, and the cache key is the text before the decision.
  seen.length = 0;
  await compileViviStory({ story, storyBeforeDecision: experienceFixtureById['v2-apartment-ru'].source }, { provider: capture });
  assert.ok(seen.every(b => !b.includes('CANARY')), 'confirmed boundary keeps the ending out');
}
ok('No outcome, reason, aftermath or written-in ending reaches generation or repair');

{
  const ACT = 'CANARY-REVEAL-ACT';
  const f = experienceFixtureById['v2-office-ru'];
  const r = await compileViviStory(
    { story: f.source, storyBeforeDecision: f.source, actualOutcome: ACT, authorWhy: 'CANARY-REVEAL-WHY', authorAfter: 'CANARY-REVEAL-AFTER' },
    { provider: createReplayProvider() }
  );
  const bundle = sealForPlayback(r.post.scenario);
  const preReveal = JSON.stringify({ scene: bundle.scene, experience: bundle.experience });
  assert.ok(!preReveal.includes('CANARY-REVEAL'), 'the stage and the action list never hold the outcome');
  assert.equal(bundle.sealed.truth.text, ACT);
  assert.equal(bundle.sealed.truth.why, 'CANARY-REVEAL-WHY');
  assert.deepEqual(bundle.scene.endings, {}, 'generated "next moment" text is not carried into playback');
  assert.equal(bundle.scene.seededStats.length, 0, 'no seeded statistics reach the player');
  assert.equal(bundle.scene.communityReflections.length, 0, 'no sample reflections reach the player');
}
ok('Pre-reveal bundle: the playable scene carries no outcome; the reveal is sealed apart (client-side boundary)');

{
  const p = proposeBoundary('Мы стояли на платформе. Поезд подъезжал. В итоге я так ничего и не сказал. Через год мы снова встретились.');
  assert.equal(p.cutAt, 2);
  assert.equal(p.before, 'Мы стояли на платформе. Поезд подъезжал.');
  assert.match(p.after, /^В итоге/);
  const en = proposeBoundary('My coworker presented my slides. The director asked for comments. In the end I stayed quiet.');
  assert.equal(en.after, 'In the end I stayed quiet.');
  const hy = splitSentences('Վերելակը բացվեց։ Ներսում ոչ ոք չկար։');
  assert.equal(hy.length, 2, 'Armenian full stop splits sentences');
  // The first sentence always stays, even if it reads like an ending.
  assert.equal(proposeBoundary('В итоге всё началось с сообщения. Я посмотрел на экран.').cutAt, 2);
  // Sequence inside the moment is not an ending; a future fact known at the time is not either.
  const office = proposeBoundary('Коллега показал мою работу. Потом она спросила: «Вопросы есть?» Через месяц именно он пишет на меня отзыв. В итоге я промолчал.');
  assert.equal(office.after, 'В итоге я промолчал.');
  // Nothing to cut.
  assert.equal(proposeBoundary('I found a wallet on the bench. There was cash inside.').after, '');
  assert.equal(boundaryAt('One. Two. Three.', 1).before, 'One.');
}
ok('The decision boundary cuts written-in endings (RU/EN/HY) and the author can move it');

{
  // A model that forgets the decision moment is asked once, through the existing single repair turn.
  const f = experienceFixtureById['v2-apartment-ru'];
  const { m: _m, ...withoutMoment } = f.dsl as Record<string, unknown>;
  const repairs: string[][] = [];
  const forgetful: ExperienceSemanticProvider = {
    id: 'forgetful',
    async compileStory() {
      return { text: JSON.stringify(withoutMoment), model: 'forgetful' };
    },
    async repair(_r: SemanticRequest, _json: string, errors: string[]) {
      repairs.push(errors);
      return { text: JSON.stringify(f.dsl), model: 'forgetful' };
    },
  };
  const r = await compileViviStory({ story: f.source, actualOutcome: 'x'.repeat(10) }, { provider: forgetful });
  assert.equal(repairs.length, 1);
  assert.ok(repairs[0].some(e => /^m is missing/.test(e)), 'the repair names the missing moment');
  assert.equal(r.post.scenario.experience?.format, 'playable', 'the repaired scene, with its moment, is the one played');
  // Saying plainly that nothing had to be decided is an answer, not an omission.
  const memory = experienceFixtureById['v2-hallway-memory-ru'];
  const quiet: string[][] = [];
  await compileViviStory({ story: memory.source }, { provider: { id: 'q', compileStory: async () => ({ text: JSON.stringify(memory.dsl), model: 'q' }), repair: async (_r, _j, e) => (quiet.push(e), { text: JSON.stringify(memory.dsl), model: 'q' }) } });
  assert.equal(quiet.length, 0, 'm.f = memory costs no repair turn');
}
ok('A program without a decision moment costs one repair turn; "memory" is an answer');

/* ----------------------------------------------------- format routing --- */

{
  // Third person, no decision: a text story.
  const third = await compileViviStory({ story: 'Однажды один человек нашёл на скамейке в парке кошелёк. Внутри были деньги и фотография.' });
  assert.equal(third.post.scenario.experience?.format, 'text_story');
  assert.ok(third.post.scenario.experience?.missing.includes('perspective'));

  // A generic fallback never becomes a game: it has no decision moment of its own.
  const fallback = await compileViviStory({ story: 'Я нашёл кошелёк на скамейке. Внутри были деньги и чей-то паспорт.', actualOutcome: 'Я отнёс его в полицию.' });
  assert.equal(fallback.report.source, 'deterministic');
  assert.notEqual(fallback.post.scenario.experience?.format, 'playable', 'no generic game with invented drama');
  assert.equal(fallback.post.scenario.experience?.clarify, 'decision_moment');

  // Specific gaps, specific questions.
  const base = { perspective: true, moment: 'The phone lights up.', whyHard: 'We promised not to.', meanings: ['look_private', 'hold'], hasAuthorAct: true };
  assert.equal(assessFormat(base).format, 'playable');
  assert.deepEqual(assessFormat({ ...base, meanings: ['look_private', 'look_private', 'look_private'] }), { format: 'illustrated_memory', missing: ['alternatives'], clarify: 'alternatives' });
  assert.equal(assessFormat({ ...base, hasAuthorAct: false }).clarify, 'author_act');
  assert.equal(assessFormat({ ...base, whyHard: '' }).clarify, 'stakes');
  // Open the door / lock the door: one place, two choices.
  assert.equal(assessFormat({ ...base, meanings: ['open_up', 'secure'] }).format, 'playable');
}
ok('Format routing: playable only with a moment, a perspective, two different deeds, stakes and the author act');

{
  assert.ok(hasFirstPerson('Ночью лифт открылся на моём этаже.'));
  assert.ok(hasFirstPerson('Ես ապրում եմ յոթերորդ հարկում։'));
  assert.ok(!hasFirstPerson('Однажды один человек нашёл кошелёк.'));
  // A fact the story does not contain is not marked as sourced.
  const src = 'Ольга сказала: «Отличная работа, Игорь». Потом она спросила: «Вопросы есть?»';
  assert.ok(findFactRef('Ольга спросила: «Вопросы есть?»', src));
  assert.equal(findFactRef('На столе лежал ноутбук с доказательствами.', src), undefined);
}
ok('Facts are traced to the author’s sentences; an unsupported claim stays unsourced');

/* ------------------------------------------------------------ legacy --- */

{
  // A post compiled before V2: stored scenario, v1 DSL, no situation layer.
  const v = validateDSL(HERO_DSL['the-message'].dsl);
  assert.ok(v.ok);
  const old = compileExperience(v.ok ? v.dsl : (null as never), { source: 'model', story: 'My partner went to shower.', createdAt: 0 });
  assert.equal(old.scenario.experience, undefined, 'a v1 program without a moment gets no situation layer silently');
  const before = JSON.stringify(old.post);
  const adapted = experienceFor(old.scenario);
  assert.equal(JSON.stringify(old.post), before, 'adapting does not modify the stored post');
  assert.equal(adapted.origin, 'legacy_adapter');
  assert.deepEqual(adapted.commitments.map(c => c.label), old.scenario.actions.map(a => a.commitLabel), 'every old deed is offered');
  assert.equal(adapted.observations.length, old.scenario.actions.length);
  assert.ok(isStoredPlayablePost(JSON.parse(before)), 'still loads as a stored post');

  // Curated hero stories and old GameSpecs still adapt.
  for (const story of heroStories.slice(0, 6)) {
    const scenario = compileHeroStoryToRuntime(story);
    const x = experienceFor(scenario);
    assert.equal(x.commitments.length, scenario.actions.length, `${story.id} keeps its deeds`);
  }
  for (const spec of SOCIAL_MEMORIES) {
    const x = experienceFor(compileGameSpecToRuntime(spec));
    assert.ok(x.commitments.length >= 2, `${spec.id} adapts`);
  }

  // A V2 scene round-trips through JSON (localStorage) unchanged.
  const fixture = compiled.get('v2-hallway-ru')!.post;
  const reloaded = JSON.parse(JSON.stringify(fixture));
  assert.ok(isStoredPlayablePost(reloaded));
  assert.deepEqual(experienceFor(reloaded.scenario), fixture.scenario.experience);
}
ok('Legacy posts, hero stories and GameSpecs load through an explicit adapter; stored scenes are untouched');

{
  // Where the hero would stand for each deed is reachable from where they start.
  for (const f of EXPERIENCE_FIXTURES.filter(f => f.expectedFormat === 'playable')) {
    const scenario = compiled.get(f.id)!.post.scenario;
    const x = scenario.experience!;
    for (const c of x.commitments) {
      const action = scenario.actions.find(a => a.id === c.id)!;
      const recipe = recipeFor(c);
      if (!recipe.approach || action.actorId) continue;
      const r = resolveApproach({
        world: scenario.world,
        from: scenario.playerSpawn,
        anchor: [action.slotInfo.anchorX, action.slotInfo.anchorY],
        stand: [action.slotInfo.standX, action.slotInfo.standY],
      });
      assert.ok(r.mode === 'walk' || r.mode === 'in_place', `${f.id}/${c.id} is walked to (${r.mode}: ${r.diagnostics.join('; ')})`);
      if (r.path) assert.equal(pathCollides(scenario.world, r.path), false);
      const direct = findPath(scenario.world, scenario.playerSpawn, [action.slotInfo.standX, action.slotInfo.standY]);
      assert.ok(direct.length >= 1);
    }
  }
}
ok('Every deed in the editorial scenes is reached on foot from the start, without collisions');

console.log(`\nAll ${n} Experience V2 checks passed.`);
