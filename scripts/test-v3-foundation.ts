import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SOCIAL_MEMORIES } from '../src/data/socialMemories.ts';
import { experienceFixtureById } from '../src/data/experienceFixtures/index.ts';
import { compileFixture } from '../src/data/experienceFixtures/replay.ts';
import { CAPS } from '../src/engine/v3/contracts/semantic.ts';
import type { PlaybackManifestV3 } from '../src/engine/v3/contracts/manifest.ts';
import type { RuntimeSnapshot } from '../src/engine/v3/contracts/state.ts';
import { findPrivateLeaks, validateManifest, validateSemanticPlan, validateStoredPostV3, type IssueCode, type ValidationIssue } from '../src/engine/v3/contracts/validate.ts';
import { isPaused, pause, resume, tick, initialClock } from '../src/engine/v3/ClockService.ts';
import { createExperience, deriveScopes, movementEligible, restoreSnapshot, step, type ExperienceEvent, type StepResult } from '../src/engine/v3/ExperienceController.ts';
import { buildReadableModel, readableEvents } from '../src/engine/v3/readable.ts';
import { entityLocation } from '../src/engine/v3/queries.ts';
import { loadPlayable } from '../src/engine/v3/compat/loadPlayable.ts';
import { FOUNDATION_REVEAL_CANARIES, foundationManifest, foundationPost, foundationReveal, foundationSemanticPlan } from '../src/engine/v3/testing/foundationFixture.ts';
import { movementCode, movementVector, routeKeydown, type KeyFacts, type RouteContext } from '../src/engine/input/routing.ts';

/**
 * V3 foundation tests (pure layers: no DOM, no React, no browser).
 *
 * The browser-level ownership tests live in scripts/test-v3-browser.ts.
 */

console.log('Testing V3 foundation (pure)...\n');
let n = 0;
const ok = (label: string) => console.log(`✓ ${++n}. ${label}`);

/* ------------------------------------------------------------ helpers --- */

const clone = <T,>(x: T): T => structuredClone(x);
const codes = (issues: readonly ValidationIssue[]): IssueCode[] => issues.map(i => i.code);
const hasIssue = (issues: readonly ValidationIssue[], code: IssueCode, pathPart?: string) => issues.some(i => i.code === code && (!pathPart || i.path.includes(pathPart) || i.message.includes(pathPart)));
const deepFreeze = <T,>(x: T): T => {
  if (x && typeof x === 'object') {
    Object.freeze(x);
    for (const v of Object.values(x as object)) deepFreeze(v);
  }
  return x;
};

let act = 0;
const aid = () => `t${++act}`;

interface Run {
  m: PlaybackManifestV3;
  s: RuntimeSnapshot;
  log: StepResult[];
}
function start(m = foundationManifest()): Run {
  let s = createExperience(m, { attemptId: 'attempt_1' });
  s = step(m, s, { type: 'LOADED' }).state;
  s = step(m, s, { type: 'ENTERED' }).state;
  return { m, s, log: [] };
}
function send(r: Run, e: ExperienceEvent): StepResult {
  const res = step(r.m, r.s, e);
  r.s = res.state;
  r.log.push(res);
  return res;
}
/** A fresh, un-narrowed view of the current snapshot (assert.equal narrows property paths). */
const snapshotOf = (r: Run): RuntimeSnapshot => r.s;
const expectOk = (res: StepResult, label: string) => assert.equal(res.rejected, undefined, `${label}: unexpectedly rejected as ${res.rejected?.code}`);
const expectRejected = (res: StepResult, code: string, label: string) => {
  assert.equal(res.rejected?.code, code, `${label}: expected ${code}, got ${res.rejected?.code ?? 'accepted'}`);
};

/** Travel through a portal: request, then complete the host's preload. */
function travel(r: Run, portal: string) {
  const req = send(r, { type: 'REQUEST_PORTAL', id: portal, activationId: aid() });
  expectOk(req, `request ${portal}`);
  const tx = req.effects.find(e => e.type === 'preload_scene');
  assert.ok(tx && tx.type === 'preload_scene', 'a preload is requested');
  expectOk(send(r, { type: 'TRANSITION_READY', txId: tx.txId }), 'commit');
  expectOk(send(r, { type: 'ENTERED' }), 'entered');
}

/** Bring the player to the decision with the minimum knowledge. */
function toDecision(r: Run) {
  expectOk(send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() }), 'observe lamp');
  expectOk(send(r, { type: 'CLOSE_OBSERVATION' }), 'close');
  travel(r, 'p_a_to_b');
  expectOk(send(r, { type: 'ADVANCE' }), 'b_b1');
  expectOk(send(r, { type: 'ADVANCE' }), 'b_b2');
  travel(r, 'p_b_to_c');
  expectOk(send(r, { type: 'ADVANCE' }), 'b_c1');
}

/* ===================================================== 1. contracts ===== */

{
  assert.deepEqual(validateManifest(foundationManifest()).issues, []);
  assert.deepEqual(validateSemanticPlan(foundationSemanticPlan()).issues, []);
  assert.deepEqual(validateStoredPostV3(foundationPost()).issues, []);
  assert.ok(validateManifest(foundationManifest(), { profile: 'launch' }).ok, 'the fixture fits the launch caps (3 scenes, 2 locations)');
}
ok('The neutral fixture validates as manifest, semantic plan and stored post');

{
  /* Each mutation must be rejected, for the right reason, at the right path. */
  const m = foundationManifest;
  const reject = (label: string, mutate: (x: any) => void, code: IssueCode, pathPart?: string) => {
    const x: any = m();
    mutate(x);
    const r = validateManifest(x);
    assert.equal(r.ok, false, `${label}: must be rejected`);
    assert.ok(hasIssue(r.issues, code, pathPart), `${label}: expected ${code}${pathPart ? ' at ' + pathPart : ''}, got ${r.issues.map(i => `${i.path}:${i.code}`).join(', ')}`);
  };
  reject('unknown fact in a beat', x => (x.scenePlans[0].beats[0].events[0].facts = ['nope']), 'unknown_ref', 'beats');
  reject('unknown fact in a decision', x => (x.primaryDecision.minimumKnowledge = ['nope']), 'unknown_ref', 'minimumKnowledge');
  reject('unknown location in a portal', x => (x.portals[0].to = 'room_z'), 'unknown_ref', 'portals[0].to');
  reject('unknown scene in a portal', x => (x.portals[0].toScene = 'scene_z'), 'unknown_ref', 'toScene');
  reject('unknown portal in a portal_state', x => (x.scenePlans[1].beats[0].events = [{ kind: 'portal_state', portal: 'p_zzz', state: 'open', fact: 'f2' }]), 'unknown_ref', 'portal');
  reject('unknown entity in an observation', x => (x.observations[0].target = { kind: 'object', id: 'ghost' }), 'unknown_ref', 'observations[0].target');
  reject('actor referenced as object', x => (x.observations[0].target = { kind: 'object', id: 'hero' }), 'unknown_ref', 'observations[0].target');
  reject('unknown beat in a gate', x => (x.portals[1].available.gates[1].id = 'b_zzz'), 'unknown_ref', 'gates');
  reject('unknown entity location in a gate', x => (x.portals[0].available = { kind: 'entity_at', id: 'hero', location: 'room_z' }), 'unknown_ref', 'location');
  reject('duplicate scene id', x => (x.scenePlans[1].id = 'scene_a'), 'duplicate_id');
  reject('duplicate entity id across kinds', x => (x.initialEntities[2].id = 'hero'), 'duplicate_id', 'initialEntities');
  reject('duplicate fact id', x => (x.facts[1].id = 'f0'), 'duplicate_id', 'facts');
  reject('beat dependency cycle', x => (x.scenePlans[1].beats[0].after = ['b_b2']), 'cycle');
  reject('beat follows itself', x => (x.scenePlans[0].beats[0].after = ['b_a1']), 'cycle');
  reject('spine portal with a return', x => (x.portals[0].returnPortal = 'p_b_peek_a'), 'graph', 'returnPortal');
  reject('excursion without a return', x => delete x.portals[2].returnPortal, 'missing_key', 'returnPortal');
  reject('return that is not the reverse edge', x => (x.portals[3].toScene = 'scene_c'), 'graph');
  reject('portal within one location', x => (x.portals[0].to = 'room_a'), 'graph');
  reject('portal scene outside its location', x => (x.portals[0].fromScene = 'scene_b'), 'graph', 'fromScene');
  reject('spine scene nobody can reach', x => (x.portals = x.portals.filter((p: any) => p.id !== 'p_b_to_c')), 'unreachable');
  reject('observation no scene offers', x => (x.scenePlans[0].observationIds = []), 'unreachable', 'observations');
  reject('option not offered in the decision scene', x => (x.scenePlans[2].opportunityIds = ['act_speak', 'act_wait']), 'graph', 'options');
  reject('decision scene off the spine', x => (x.spine = ['scene_a', 'scene_b']), 'graph');
  reject('opportunity not an option', x => (x.primaryDecision.options = ['act_speak', 'act_wait']), 'graph', 'opportunities');
  reject('a single option is not a decision', x => (x.primaryDecision.options = ['act_speak']), 'cap', 'options');
  reject('boundary away from the decision scene', x => (x.truthBoundary.scene = 'scene_a'), 'graph', 'truthBoundary');
  reject('opportunity belongs to no decision', x => (x.opportunities[0].decision = 'd_other'), 'unknown_ref', 'decision');
  reject('timed window is unsupported', x => (x.opportunities[0].window = { timingFact: 'f1' }), 'unsupported', 'window');
  reject('hero is not an actor', x => (x.perspectiveActor = 'lamp'), 'unknown_ref', 'perspectiveActor');
  reject('hero starts elsewhere', x => (x.initialEntities[0].owner.id = 'room_b'), 'graph', 'perspectiveActor');
  reject('object carried by an unknown actor', x => (x.initialEntities[2].owner = { kind: 'actor', id: 'ghost' }), 'unknown_ref');
  reject('actor carried by an actor', x => (x.initialEntities[1].owner = { kind: 'actor', id: 'hero' }), 'graph');
  reject('required fact without accessible text', x => (x.compiledScenes[0].accessibleText = x.compiledScenes[0].accessibleText.slice(1)), 'graph', 'accessibleText');
  reject('scene plan without a compiled scene', x => (x.compiledScenes = x.compiledScenes.slice(1)), 'graph');
  reject('compiled scene disagrees about location', x => (x.compiledScenes[0].location = 'room_b'), 'graph', 'location');
  reject('memory format must not carry a decision', x => (x.format = 'memory'), 'graph');
  reject('text format has no playback manifest', x => (x.format = 'text'), 'unsupported', 'format');
}
ok('Invalid cross-references, duplicate ids, cycles and graph violations are rejected with a path and a code');

{
  const m = foundationManifest;
  const reject = (label: string, mutate: (x: any) => void, code: IssueCode, pathPart?: string, opts?: Parameters<typeof validateManifest>[1]) => {
    const x: any = m();
    mutate(x);
    const r = validateManifest(x, opts);
    assert.ok(!r.ok && hasIssue(r.issues, code, pathPart), `${label}: expected ${code}, got ${r.ok ? 'accepted' : r.issues.map(i => `${i.path}:${i.code}`).join(', ')}`);
  };
  const scene = (i: number) => {
    const base = foundationManifest().scenePlans[0];
    return { ...clone(base), id: `s${i}`, beats: [], observationIds: [] };
  };
  // Hard caps
  reject('more than 8 scenes', x => {
    x.scenePlans = Array.from({ length: 9 }, (_, i) => scene(i));
  }, 'cap', 'scenePlans');
  reject('more than 32 facts', x => (x.facts = Array.from({ length: 33 }, (_, i) => ({ id: `fx${i}`, text: 'a fact', kind: 'observed' }))), 'cap', 'facts');
  reject('more than 12 observations', x => (x.observations = Array.from({ length: 13 }, (_, i) => ({ ...clone(x.observations[0]), id: `ox${i}` }))), 'cap', 'observations');
  reject('more than 4 options', x => (x.primaryDecision.options = ['a1', 'a2', 'a3', 'a4', 'a5']), 'cap', 'options');
  reject('more than 48 semantic events', x => {
    x.scenePlans[0].beats = Array.from({ length: 12 }, (_, i) => ({ id: `bb${i}`, after: [], events: Array.from({ length: 5 }, () => ({ kind: 'hold' })), emphasis: 'held', delivery: 'reader' }));
  }, 'cap', 'semantic events');
  reject('more than 5 locations', x => {
    x.scenePlans = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].map((l, i) => ({ ...scene(i), location: l }));
  }, 'cap', 'scenePlans');
  reject('gates nest at most 2 deep', x => (x.portals[0].available = { kind: 'all', gates: [{ kind: 'all', gates: [{ kind: 'all', gates: [{ kind: 'always' }] }] }] }), 'cap', 'available');
  reject('label too long', x => (x.observations[0].label = 'x'.repeat(CAPS.labelLength + 1)), 'cap', 'label');
  reject('micro format allows one scene', x => (x.format = 'micro'), 'cap', 'scenePlans');
  reject('launch profile allows 4 scenes', x => {
    x.scenePlans = Array.from({ length: 5 }, (_, i) => scene(i));
  }, 'cap', 'scenePlans', { profile: 'launch' });

  // Closed schema: nothing the contract does not name may ride along.
  reject('unknown top-level key', x => (x.script = 'x'), 'unknown_key', 'script');
  reject('coordinates on a semantic scene', x => (x.scenePlans[0].x = 12), 'unknown_key', 'scenePlans[0].x');
  reject('a file name on a scene', x => (x.scenePlans[0].file = 'a.png'), 'unknown_key');
  reject('a style on an observation', x => (x.observations[0].style = 'color:red'), 'unknown_key');
  reject('reveal act in the manifest', x => (x.act = 'text'), 'unknown_key', 'act');
  reject('reveal why in the manifest', x => (x.why = 'text'), 'unknown_key', 'why');
  reject('aftermath in the manifest', x => (x.aftermath = 'text'), 'unknown_key', 'aftermath');
  reject('author option mapping in an opportunity', x => (x.opportunities[0].authorOption = 'act_speak'), 'unknown_key');

  // Identifiers are not paths, urls or names.
  reject('a path as an asset id', x => (x.compiledScenes[0].cameraRecipe = '../cam.png'), 'id_format', 'cameraRecipe');
  reject('a url as a scene composition', x => (x.scenePlans[0].composition = 'https://x.test/a.png'), 'id_format', 'composition');
  reject('an uppercase id', x => (x.scenePlans[0].id = 'Scene_A'), 'id_format');

  // Free text is data, never markup, style, script or url.
  for (const [label, bad] of [
    ['a url', 'see https://example.test/a'],
    ['a protocol-less host', 'visit www.example.test'],
    ['a javascript: url', 'javascript:alert(1)'],
    ['a data: url', 'data:text/html;base64,AAAA'],
    ['html', 'hello <script>x</script>'],
    ['an html tag', '<img src=x>'],
    ['a css block', 'text { color: red }'],
    ['a template expression', 'text ${process.env.X}'],
    ['an arrow function', 'x => x'],
    ['an eval call', 'eval(1)'],
    ['a control character', 'a\u0007b'],
  ] as const) reject(`free text containing ${label}`, x => (x.facts[0].text = bad), 'forbidden_content', 'facts[0].text');
  reject('empty label', x => (x.observations[0].label = '   '), 'text_format', 'label');

  // Versions are explicit.
  reject('future runtime version', x => (x.runtimeManifestVersion = 4), 'version', 'runtimeManifestVersion');
  reject('future semantic version', x => (x.semanticSchemaVersion = 4), 'version', 'semanticSchemaVersion');
  reject('missing compiler version', x => (x.compilerVersion = 'latest'), 'version', 'compilerVersion');
  reject('missing asset revision', x => (x.assetRevisions = { kit_neutral: 7 }), 'version', 'assetRevisions');
  reject('bad asset hash', x => (x.assetHashes = { kit_neutral: 'nothex' }), 'text_format', 'assetHashes');

  // Vocabulary: when an approved vocabulary is supplied, anything outside it is rejected.
  const vocab = { compositions: new Set(['comp_other']) };
  reject('composition outside the approved vocabulary', () => {}, 'enum', 'composition', { vocab });
  const sp = foundationSemanticPlan();
  assert.ok(!validateSemanticPlan(sp, { vocab: { kitFamilies: new Set(['kit_other']) } }).ok, 'kit family outside the vocabulary');
  assert.ok(validateSemanticPlan(sp, { vocab: { kitFamilies: new Set(['kit_neutral']), assetClasses: new Set(['lamp', 'document']), roles: new Set(['hero', 'other']) } }).ok);
}
ok('Hard caps, closed schema, id/text hygiene, explicit versions and vocabularies are enforced at runtime');

{
  const p: any = foundationSemanticPlan();
  p.scenes[0].beats[0].events[0].facts = ['no_such_fact'];
  p.actors[0].initialLocation = 'nowhere';
  p.tension.perspectiveActor = 'lamp';
  const r = validateSemanticPlan(p);
  assert.ok(!r.ok);
  assert.ok(hasIssue(r.issues, 'unknown_ref', 'actors[0].initialLocation'));
  assert.ok(hasIssue(r.issues, 'unknown_ref', 'perspectiveActor'));
  const q: any = foundationSemanticPlan();
  q.scenes[0].x = 4;
  q.presentation.time = 'evidence_window';
  q.objects[0].owner = { kind: 'actor', id: 'lamp' };
  const r2 = validateSemanticPlan(q);
  assert.ok(!r2.ok && hasIssue(r2.issues, 'unknown_key', 'scenes[0].x') && hasIssue(r2.issues, 'enum', 'presentation.time') && hasIssue(r2.issues, 'unknown_ref', 'owner'));
  const mem: any = foundationSemanticPlan();
  mem.formatProposal = 'memory';
  assert.ok(!validateSemanticPlan(mem).ok, 'memory needs no tension or decision');
  // Types are not validation: wrong JSON types fail.
  for (const junk of [null, 5, 'x', [], {}, { semanticSchemaVersion: 3 }]) assert.equal(validateSemanticPlan(junk).ok, false);
  for (const junk of [null, 5, 'x', [], {}, { runtimeManifestVersion: 3 }]) assert.equal(validateManifest(junk).ok, false);
}
ok('The semantic plan validator rejects bad references, coordinates, unsupported time and non-object input');

{
  // Diagnostics never copy story text.
  const x: any = foundationManifest();
  x.facts[0].text = 'LEAKY-STORY-TEXT see https://example.test';
  x.observations[0].label = 'LEAKY-LABEL <b>';
  const r = validateManifest(x);
  assert.ok(!r.ok);
  assert.ok(!JSON.stringify(r.issues).includes('LEAKY'), 'issues carry paths and codes, never the offending text');
}
ok('Validation issues never echo the offending text');

{
  const m = foundationManifest();
  const reveal = foundationReveal();
  assert.deepEqual(findPrivateLeaks(m, FOUNDATION_REVEAL_CANARIES), [], 'the public manifest holds no reveal text');
  assert.deepEqual(findPrivateLeaks(foundationSemanticPlan(), FOUNDATION_REVEAL_CANARIES), [], 'nor does the semantic plan');
  assert.deepEqual(findPrivateLeaks(foundationPost(), FOUNDATION_REVEAL_CANARIES), [], 'nor the stored post');
  assert.ok(findPrivateLeaks(reveal, FOUNDATION_REVEAL_CANARIES).length === 3, 'the reveal record is where they live');
  const dirty = clone(m);
  dirty.observations[0].label = `Look ${FOUNDATION_REVEAL_CANARIES[1].toLowerCase()}`;
  assert.deepEqual(findPrivateLeaks(dirty, FOUNDATION_REVEAL_CANARIES), [1], 'a leak is found, by index, case-insensitively');
  // The runtime snapshot of a whole run never contains them either.
  const r = start();
  toDecision(r);
  assert.deepEqual(findPrivateLeaks(r.s, FOUNDATION_REVEAL_CANARIES), []);
  assert.deepEqual(findPrivateLeaks(buildReadableModel(r.m, r.s), FOUNDATION_REVEAL_CANARIES), []);
  // The reveal is requested by reference, after the boundary, and the request carries no text.
  expectOk(send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() }), 'request');
  const c = send(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() });
  assert.deepEqual(findPrivateLeaks(c.effects, FOUNDATION_REVEAL_CANARIES), []);
  send(r, { type: 'ENACTED' });
  send(r, { type: 'HOLD_DONE' });
  const b = send(r, { type: 'BOUNDARY_DONE' });
  assert.deepEqual(b.effects, [{ type: 'load_reveal', experienceId: 'foundation_fixture', revision: 'r1' }]);
}
ok('Reveal data cannot be found in the semantic plan, public manifest, stored post, snapshots, readable model or effects');

/* ===================================================== 2. controller ==== */

{
  const m = foundationManifest();
  let s = createExperience(m, { attemptId: 'a' });
  assert.equal(s.phase, 'loading');
  assert.equal(s.scene, 'scene_a');
  assert.equal(s.location, 'room_a');
  assert.deepEqual(s.visitedScenes, ['scene_a']);
  assert.notEqual(s.entities, m.initialEntities, 'the snapshot owns its own entities');
  assert.equal(step(m, s, { type: 'OPEN_OBSERVATION', id: 'o_a1' }).rejected?.code, 'wrong_phase', 'nothing is interactive while loading');
  s = step(m, s, { type: 'LOADED' }).state;
  assert.equal(s.phase, 'entering');
  assert.equal(step(m, s, { type: 'OPEN_OBSERVATION', id: 'o_a1' }).rejected?.code, 'wrong_phase', 'nor while entering');
  s = step(m, s, { type: 'ENTERED' }).state;
  assert.equal(s.phase, 'playing');
  assert.equal(step(m, s, { type: 'LOADED' }).rejected?.code, 'wrong_phase', 'events out of order are ignored');
  JSON.stringify(s); // plain data, serialisable
}
ok('Lifecycle: loading → entering → playing; out-of-order events are rejected without changing state');

{
  const r = start();
  const obs = send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  expectOk(obs, 'open');
  assert.deepEqual(r.s.receivedFacts, ['f1']);
  assert.deepEqual(r.s.seenObservations, ['o_a1']);
  assert.equal(r.s.openObservation, 'o_a1');
  assert.ok(isPaused(r.s.time, 'reading'), 'reading pauses narrative time');
  assert.equal(movementEligible(r.s), false, 'no locomotion behind an observation');
  assert.deepEqual(deriveScopes(r.s), ['observation']);
  expectRejected(send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() }), 'busy', 'a second observation over the first');
  expectOk(send(r, { type: 'CLOSE_OBSERVATION' }), 'close');
  assert.ok(!isPaused(r.s.time));
  // Reopening records nothing twice.
  expectOk(send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() }), 'reopen');
  assert.deepEqual(r.s.receivedFacts, ['f1']);
  assert.deepEqual(r.s.seenObservations, ['o_a1']);
  expectOk(send(r, { type: 'CANCEL' }), 'cancel closes the observation');
  assert.equal(r.s.openObservation, undefined);
  expectRejected(send(r, { type: 'OPEN_OBSERVATION', id: 'o_b1', activationId: aid() }), 'unavailable', 'an observation of another scene');
  expectRejected(send(r, { type: 'OPEN_OBSERVATION', id: 'nope', activationId: aid() }), 'unknown_id', 'unknown id');
  assert.ok(!r.s.entities.some(e => e.state.seen), 'looking never edits entities');
  assert.equal(r.s.decision, undefined, 'observation never records a decision');
}
ok('Observation delivers facts once, pauses reading, blocks locomotion and never records a decision');

{
  // Enter has one defined meaning: open something, never commit.
  const r = start();
  const sheet = send(r, { type: 'ACTIVATE_CONTEXT', activationId: aid() });
  expectOk(sheet, 'Enter with no target');
  assert.deepEqual(r.s.sheet && { kind: r.s.sheet.kind }, { kind: 'actions' }, 'no target → the list of everything available');
  assert.ok(r.s.sheet!.openedBy.startsWith('t'));
  assert.deepEqual(deriveScopes(r.s), ['intent_sheet']);
  expectRejected(send(r, { type: 'ACTIVATE_CONTEXT', activationId: aid() }), 'busy', 'Enter again while the sheet is open');
  expectOk(send(r, { type: 'CLOSE_SHEET' }), 'close');
  assert.equal(r.s.decision, undefined);

  // A selected target with exactly one observation opens it directly.
  expectOk(send(r, { type: 'SELECT_TARGET', target: { kind: 'object', id: 'lamp' } }), 'select lamp');
  expectOk(send(r, { type: 'ACTIVATE_CONTEXT', activationId: aid() }), 'Enter on the lamp');
  assert.equal(r.s.openObservation, 'o_a1');
  assert.equal(r.s.selectedTarget, undefined, 'selection is consumed');
  send(r, { type: 'CLOSE_OBSERVATION' });

  // A target with several actions lists them instead.
  expectOk(send(r, { type: 'SELECT_TARGET', target: { kind: 'self' } }), 'select self');
  expectOk(send(r, { type: 'ACTIVATE_CONTEXT', activationId: aid() }), 'Enter on self');
  assert.equal(r.s.sheet?.kind, 'target');
  send(r, { type: 'CLOSE_SHEET' });
  expectRejected(send(r, { type: 'SELECT_TARGET', target: { kind: 'object', id: 'ghost' } }), 'unknown_id', 'select an unknown target');
  expectOk(send(r, { type: 'SELECT_TARGET', target: { kind: 'object', id: 'note' } }), 'select note');
  expectOk(send(r, { type: 'CANCEL' }), 'cancel clears the selection');
  assert.equal(r.s.selectedTarget, undefined);
  expectRejected(send(r, { type: 'CANCEL' }), 'nothing_to_cancel', 'cancel with nothing open');
}
ok('Enter (ACTIVATE_CONTEXT) opens the contextual target or the action list and never commits anything');

{
  // One physical activation is spent on at most one state change.
  const r = start();
  toDecision(r);
  const k = 'k77'; // a single held Enter
  expectOk(send(r, { type: 'ACTIVATE_CONTEXT', activationId: k }), 'opens the sheet');
  expectRejected(send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: k }), 'duplicate_activation', 'the same press cannot select an act');
  assert.equal(r.s.phase, 'playing');
  assert.equal(r.s.reservation, undefined);
  expectOk(send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: 'k78' }), 'a second press selects');
  assert.equal(r.s.phase, 'confirming');
  expectRejected(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: 'k78' }), 'duplicate_activation', 'the press that opened confirmation cannot confirm');
  expectRejected(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: k }), 'duplicate_activation', 'nor an older press');
  assert.equal(snapshotOf(r).decision, undefined, 'nothing was committed by any of those');
  expectRejected(send(r, { type: 'CONFIRM', id: 'act_wait', activationId: 'k79' }), 'stale_confirmation', 'confirming a different act than the one reserved');
  expectOk(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: 'k79' }), 'a third press confirms');
  assert.equal(snapshotOf(r).decision?.option, 'act_speak');
}
ok('One keypress can never both open and confirm; a repeated activation id is rejected as a duplicate');

{
  const r = start();
  toDecision(r);
  // Stale: confirming with nothing reserved.
  expectRejected(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() }), 'stale_confirmation', 'confirm with no reservation');
  expectRejected(send(r, { type: 'REQUEST_INTENT', id: 'nope', activationId: aid() }), 'unknown_id', 'unknown intent');
  expectOk(send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() }), 'reserve');
  // Reserve then cancel: the window is released, nothing accepted.
  expectOk(send(r, { type: 'CANCEL' }), 'cancel');
  assert.equal(r.s.phase, 'playing');
  assert.equal(r.s.reservation, undefined);
  assert.ok(!isPaused(r.s.time), 'cancelling releases the pause');
  expectRejected(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() }), 'stale_confirmation', 'a confirmation from before the cancel is stale');
  // The other option can be taken after a cancel.
  expectOk(send(r, { type: 'REQUEST_INTENT', id: 'act_wait', activationId: aid() }), 'other option');
  assert.equal(snapshotOf(r).reservation?.option, 'act_wait');
  assert.equal(movementEligible(r.s), false);
  assert.deepEqual(deriveScopes(r.s), ['intent_sheet']);
  expectRejected(send(r, { type: 'SELECT_TARGET', target: { kind: 'self' } }), 'wrong_phase', 'selection while confirmation owns focus');
  expectRejected(send(r, { type: 'REQUEST_PORTAL', id: 'p_b_to_c', activationId: aid() }), 'wrong_phase', 'no travel while confirming');
}
ok('Stale confirmations are rejected; cancelling releases the reservation without accepting anything');

{
  const r = start();
  toDecision(r);
  // Knowledge gate: the decision needs f1, f2 and f3.
  const early = start();
  expectRejected(send(early, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() }), 'wrong_scene', 'an act outside the decision scene');
  const missing = start();
  missing.s = { ...clone(r.s), phase: 'playing', receivedFacts: ['f1'], decision: undefined, reservation: undefined, boundaryLocked: false, scene: 'scene_c', location: 'room_a' };
  expectRejected(send(missing, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() }), 'knowledge_missing', 'acting before knowing enough');
  assert.deepEqual(buildReadableModel(missing.m, missing.s).decision.missingKnowledge, ['f2', 'f3']);
}
ok('An act cannot be requested before the minimum knowledge is received or outside the decision scene');

{
  const r = start();
  toDecision(r);
  expectOk(send(r, { type: 'REQUEST_INTENT', id: 'act_ask', activationId: aid() }), 'reserve');
  const first = send(r, { type: 'CONFIRM', id: 'act_ask', activationId: aid() });
  expectOk(first, 'accept');
  assert.deepEqual(first.effects.map(e => e.type), ['persist_decision', 'enact', 'save_snapshot']);
  assert.deepEqual(first.effects[0], { type: 'persist_decision', decision: 'd_main', option: 'act_ask' });
  assert.equal(r.s.phase, 'enacting');
  assert.deepEqual(r.s.decision, { id: 'd_main', option: 'act_ask', status: 'accepted' });
  // Idempotent: the same act again is a no-op, never a new choice, never another effect.
  const dup = send(r, { type: 'CONFIRM', id: 'act_ask', activationId: aid() });
  expectRejected(dup, 'duplicate_decision', 'same act again');
  assert.ok(!dup.effects.some(e => e.type === 'persist_decision' || e.type === 'enact'));
  expectRejected(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() }), 'decision_closed', 'a different act after the decision');
  expectRejected(send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() }), 'decision_closed', 'selecting another act after the decision');
  expectRejected(send(r, { type: 'REQUEST_INTENT', id: 'act_ask', activationId: aid() }), 'duplicate_decision', 'selecting the same act again');
  assert.equal(r.log.filter(x => x.effects.some(e => e.type === 'persist_decision')).length, 1, 'persisted exactly once');
  expectOk(send(r, { type: 'DECISION_RECORDED' }), 'recorded');
  assert.equal(r.s.decision?.status, 'recorded');
  assert.equal(r.s.decision?.option, 'act_ask', 'the accepted option never changes');
}
ok('The decision is idempotent: one persisted act, duplicates are no-ops, alternatives are closed');

{
  const r = start();
  toDecision(r);
  expectOk(send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() }), 'reserve');
  expectOk(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() }), 'accept');
  const frozen = clone(r.s);
  // Every causal mutation is refused, and refusal leaves the very same state object.
  for (const e of [
    { type: 'OPEN_OBSERVATION', id: 'o_a1' },
    { type: 'REQUEST_PORTAL', id: 'p_b_peek_a', activationId: aid() },
    { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() },
    { type: 'REVERT_PREPARATION', id: 'prep_stand' },
    { type: 'ADVANCE' },
    { type: 'SELECT_TARGET', target: { kind: 'self' } },
    { type: 'ACTIVATE_CONTEXT', activationId: aid() },
    { type: 'OPEN_ACTIONS' },
    { type: 'CANCEL' },
    { type: 'TRANSITION_READY', txId: 'tx1' },
  ] as ExperienceEvent[]) {
    const before = r.s;
    expectRejected(send(r, e), 'locked', `${e.type} after the truth boundary`);
    assert.equal(r.s, before, `${e.type}: the state object is untouched`);
  }
  assert.deepEqual(r.s, frozen);
  // Presentation and reveal progress remain possible.
  expectOk(send(r, { type: 'TICK', dtMs: 16 }), 'tick');
  expectOk(send(r, { type: 'OPEN_MODAL', id: 'settings' }), 'modal');
  expectOk(send(r, { type: 'CANCEL' }), 'cancel closes the modal even when locked');
  expectOk(send(r, { type: 'ENACTED' }), 'enacted');
  assert.equal(r.s.phase, 'holding');
  expectOk(send(r, { type: 'SKIP' }), 'skip');
  assert.equal(r.s.phase, 'boundary');
  assert.equal(r.s.decision?.option, 'act_speak', 'skip never alters the accepted act');
  expectOk(send(r, { type: 'BOUNDARY_DONE' }), 'boundary');
  assert.equal(r.s.phase, 'reveal_loading');
  expectOk(send(r, { type: 'REVEAL_FAILED' }), 'network failure');
  assert.equal(r.s.reveal, 'failed');
  assert.equal(r.s.decision?.option, 'act_speak', 'failure keeps the accepted act');
  const retry = send(r, { type: 'RETRY_REVEAL' });
  expectOk(retry, 'retry');
  assert.equal(retry.effects[0].type, 'load_reveal');
  expectRejected(send(r, { type: 'REQUEST_INTENT', id: 'act_wait', activationId: aid() }), 'decision_closed', 'no second choice to unlock the reveal');
  expectOk(send(r, { type: 'REVEAL_LOADED' }), 'loaded');
  assert.equal(r.s.phase, 'revealed');
  expectOk(send(r, { type: 'END' }), 'end');
  assert.equal(r.s.phase, 'ended');
  assert.deepEqual(r.s.entities, frozen.entities, 'entities never changed after the boundary');
  assert.deepEqual(r.s.receivedFacts, frozen.receivedFacts);
}
ok('Truth boundary: after the accepted act only presentation and reveal progress; no causal mutation; skip cannot create or change an act');

{
  const r = start();
  expectRejected(send(r, { type: 'SKIP' }), 'skip_before_commit', 'skipping before any act');
  expectRejected(send(r, { type: 'BOUNDARY_DONE' }), 'wrong_phase', 'jumping to the reveal');
  expectRejected(send(r, { type: 'REVEAL_LOADED' }), 'wrong_phase', 'revealing without a boundary');
  expectRejected(send(r, { type: 'REACH_BOUNDARY' }), 'wrong_phase', 'a playable story has no memory boundary');
  assert.equal(r.s.phase, 'playing');
  // The memory form: no decision, the boundary is the end of the account.
  const m = foundationManifest();
  const mem: any = m;
  mem.format = 'memory';
  mem.tension = null;
  mem.primaryDecision = null;
  mem.opportunities = [];
  mem.scenePlans[2].opportunityIds = [];
  mem.truthBoundary = { scene: 'scene_c', after: 'memory_end' };
  assert.deepEqual(validateManifest(mem).issues, [], 'a memory manifest is valid');
  const mr = start(m);
  expectOk(send(mr, { type: 'REACH_BOUNDARY' }), 'memory boundary');
  assert.equal(mr.s.phase, 'boundary');
  assert.equal(mr.s.boundaryLocked, true);
  assert.equal(mr.s.decision, undefined, 'a memory never records a decision');
  expectRejected(send(mr, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() }), 'locked', 'no act in a memory');
}
ok('Reveal cannot be reached without an accepted act (or the memory form); skip before commit is refused');

/* ======================================== 3. multi-scene persistence ===== */

{
  const r = start();
  // Scene A: look, prepare, deliver the context beat.
  expectOk(send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() }), 'observe');
  send(r, { type: 'CLOSE_OBSERVATION' });
  expectOk(send(r, { type: 'ADVANCE' }), 'beat');
  expectOk(send(r, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'stand');
  expectOk(send(r, { type: 'APPLY_PREPARATION', id: 'prep_hold_note', activationId: aid() }), 'hold note');
  assert.deepEqual(r.s.entities.find(e => e.id === 'note')!.owner, { kind: 'actor', id: 'hero' });
  const factsA = [...r.s.receivedFacts];

  // A → B
  travel(r, 'p_a_to_b');
  assert.equal(r.s.scene, 'scene_b');
  assert.equal(r.s.location, 'room_b');
  assert.equal(r.s.arcIndex, 1);
  assert.equal(entityLocation(r.s, 'hero'), 'room_b');
  assert.equal(entityLocation(r.s, 'note'), 'room_b', 'what the hero carries travels with them');
  assert.equal(entityLocation(r.s, 'other'), 'room_b');
  assert.equal(entityLocation(r.s, 'lamp'), 'room_a', 'everything else stays put');
  expectOk(send(r, { type: 'ADVANCE' }), 'b_b1');
  assert.ok(r.s.receivedFacts.includes('f2'));

  // B → A (reversible excursion) → B
  travel(r, 'p_b_peek_a');
  assert.equal(r.s.scene, 'scene_a');
  assert.equal(r.s.arcIndex, 1, 'an excursion never moves the arc');
  assert.equal(entityLocation(r.s, 'hero'), 'room_a');
  // The world did not reset: facts, observations, beats, preparations and ownership are all intact.
  assert.deepEqual(factsA.filter(f => !r.s.receivedFacts.includes(f)), [], 'no fact lost');
  assert.ok(r.s.receivedFacts.includes('f2'), 'a fact learned elsewhere is kept');
  assert.deepEqual(r.s.seenObservations, ['o_a1']);
  assert.deepEqual(r.s.deliveredBeats, ['b_a1', 'b_b1'], 'no beat is delivered twice or forgotten');
  assert.deepEqual(r.s.preparations.map(p => p.id), ['prep_stand', 'prep_hold_note']);
  assert.equal(r.s.entities.find(e => e.id === 'hero')!.state.mark_role, 'near_other');
  assert.deepEqual(r.s.entities.find(e => e.id === 'note')!.owner, { kind: 'actor', id: 'hero' });
  assert.equal(entityLocation(r.s, 'other'), 'room_b', 'the other person did not move or duplicate');
  assert.equal(r.s.entities.length, 4, 'no duplicate entities');
  assert.deepEqual(r.s.visitedScenes, ['scene_a', 'scene_b']);
  // The one-shot beat is not repeated on return.
  expectRejected(send(r, { type: 'ADVANCE' }), 'nothing_to_advance', 'scene A has nothing new to deliver');
  assert.equal(r.s.consumedEvents.filter(e => e === 'b_a1:0').length, 1);

  travel(r, 'p_a_back_b');
  assert.equal(r.s.scene, 'scene_b');
  expectOk(send(r, { type: 'ADVANCE' }), 'b_b2');
  assert.equal(entityLocation(r.s, 'other'), 'room_a', 'a sourced transfer moves the actor exactly once');
  travel(r, 'p_b_to_c');
  assert.equal(r.s.scene, 'scene_c');
  assert.equal(r.s.arcIndex, 2);
  assert.equal(entityLocation(r.s, 'other'), 'room_a');
  assert.equal(entityLocation(r.s, 'note'), 'room_a');
  // History is not rewound: nothing leads back from the decision scene.
  const model = buildReadableModel(r.m, r.s);
  assert.deepEqual(model.portals, [], 'no way back from the decision scene');
}
ok('Scene A → B → A → B → C keeps facts, beats, preparation, ownership and actors; nothing resets or duplicates');

{
  const r = start();
  // Not yet reachable: the return edge leads to a scene beyond the arc.
  expectRejected(send(r, { type: 'REQUEST_PORTAL', id: 'p_a_back_b', activationId: aid() }), 'ahead_of_arc', 'excursion ahead of the arc');
  expectRejected(send(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() }), 'unavailable', 'gate: fact f1 not yet received');
  expectRejected(send(r, { type: 'REQUEST_PORTAL', id: 'p_b_to_c', activationId: aid() }), 'wrong_scene', 'a portal from another scene');
  expectRejected(send(r, { type: 'REQUEST_PORTAL', id: 'nope', activationId: aid() }), 'unknown_id', 'unknown portal');
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  expectRejected(send(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() }), 'busy', 'travel behind an open observation');
  send(r, { type: 'CLOSE_OBSERVATION' });
}
ok('Portals respect arc order, gates, current scene and open interaction');

{
  const r = start();
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  const before = clone(r.s);
  const req = send(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() });
  expectOk(req, 'request');
  assert.equal(r.s.phase, 'transitioning');
  assert.equal(r.s.transition?.toScene, 'scene_b');
  assert.equal(r.s.scene, 'scene_a', 'nothing is swapped until the commit');
  assert.equal(entityLocation(r.s, 'hero'), 'room_a');
  assert.deepEqual(req.effects, [{ type: 'preload_scene', txId: 'tx1', scene: 'scene_b' }]);
  assert.ok(isPaused(r.s.time, 'transition'));
  assert.deepEqual(deriveScopes(r.s), ['transition']);
  assert.equal(movementEligible(r.s), false);
  // Idempotent / frozen: no second transaction and no conflicting interaction.
  expectRejected(send(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() }), 'busy', 'the same portal requested again');
  expectRejected(send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() }), 'wrong_phase', 'observing mid-transition');
  expectRejected(send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() }), 'wrong_phase', 'acting mid-transition');
  expectRejected(send(r, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'wrong_phase', 'preparing mid-transition');
  // Stale completions are rejected and change nothing.
  const snap = r.s;
  expectRejected(send(r, { type: 'TRANSITION_READY', txId: 'tx0' }), 'stale_transaction', 'wrong transaction');
  assert.equal(r.s, snap);
  // A failed preload leaves the source exactly as it was.
  expectOk(send(r, { type: 'TRANSITION_FAILED', txId: 'tx1' }), 'failure');
  assert.equal(r.s.phase, 'playing');
  assert.equal(r.s.scene, 'scene_a');
  assert.equal(r.s.transition, undefined);
  assert.ok(!isPaused(r.s.time));
  const norm = (x: RuntimeSnapshot) => JSON.parse(JSON.stringify({ ...x, txCounter: 0, consumedActivations: [] }));
  assert.deepEqual(norm(r.s), norm(before), 'failure restored the source state');
  expectRejected(send(r, { type: 'TRANSITION_READY', txId: 'tx1' }), 'stale_transaction', 'a late completion of the failed transaction');
  // Retry gets a new, deterministic transaction id; commit swaps atomically; a duplicate completion is stale.
  const again = send(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() });
  assert.equal((again.effects[0] as any).txId, 'tx2');
  const commit = send(r, { type: 'TRANSITION_READY', txId: 'tx2' });
  expectOk(commit, 'commit');
  assert.equal(r.s.phase, 'entering');
  assert.equal(r.s.scene, 'scene_b');
  assert.equal(r.s.location, 'room_b');
  assert.equal(r.s.transition, undefined);
  assert.deepEqual(commit.effects, [{ type: 'save_snapshot' }, { type: 'focus_handoff', scene: 'scene_b' }]);
  expectRejected(send(r, { type: 'TRANSITION_READY', txId: 'tx2' }), 'stale_transaction', 'a duplicate completion');
  assert.deepEqual(deriveScopes(r.s), ['transition'], 'input stays unowned until the focus handoff');
  expectRejected(send(r, { type: 'OPEN_OBSERVATION', id: 'o_b1', activationId: aid() }), 'wrong_phase', 'interaction before entry completes');
  expectOk(send(r, { type: 'ENTERED' }), 'handoff done');
  assert.equal(r.s.phase, 'playing');
  assert.deepEqual(deriveScopes(r.s), []);
  assert.equal(movementEligible(r.s), true, 'the world owns input again');
}
ok('Portal transaction: request → freeze → preload → atomic swap → handoff; stale, duplicate and failed transitions are safe');

{
  // A portal the story closed stays closed; a closed door is not a room to explore.
  const m = foundationManifest();
  m.scenePlans[1].beats[0].events.push({ kind: 'portal_state', portal: 'p_b_peek_a', state: 'closed', fact: 'f5' });
  assert.deepEqual(validateManifest(m).issues, []);
  const r = start(m);
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  travel(r, 'p_a_to_b');
  expectOk(send(r, { type: 'ADVANCE' }), 'closing beat');
  assert.equal(r.s.variables['portal_p_b_peek_a'], 'closed');
  expectRejected(send(r, { type: 'REQUEST_PORTAL', id: 'p_b_peek_a', activationId: aid() }), 'closed', 'a closed portal');
  assert.equal(buildReadableModel(r.m, r.s).portals.find(p => p.id === 'p_b_peek_a')?.blockedBy, 'closed');
}
ok('Portal state set by a sourced event closes a portal, and the readable model says why');

{
  // Preparations: reversible, closed recipes that touch only the hero's own reach.
  const r = start();
  expectOk(send(r, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'reposition');
  expectRejected(send(r, { type: 'APPLY_PREPARATION', id: 'prep_stand', activationId: aid() }), 'already_applied', 'twice');
  assert.equal(r.s.entities.find(e => e.id === 'hero')!.state.mark_role, 'near_other');
  expectOk(send(r, { type: 'REVERT_PREPARATION', id: 'prep_stand' }), 'revert');
  assert.equal(r.s.entities.find(e => e.id === 'hero')!.state.mark_role, undefined, 'revert restores the previous value exactly');
  expectRejected(send(r, { type: 'REVERT_PREPARATION', id: 'prep_stand' }), 'not_applied', 'revert twice');
  const original = clone(r.s.entities);
  expectOk(send(r, { type: 'APPLY_PREPARATION', id: 'prep_hold_note', activationId: aid() }), 'hold');
  expectOk(send(r, { type: 'REVERT_PREPARATION', id: 'prep_hold_note' }), 'put it back');
  assert.deepEqual(r.s.entities, original, 'apply + revert is a no-op');
  // Put back what is carried, where the hero stands.
  expectRejected(send(r, { type: 'APPLY_PREPARATION', id: 'prep_put_back_note', activationId: aid() }), 'unavailable', 'putting back what is not held');
  send(r, { type: 'APPLY_PREPARATION', id: 'prep_hold_note', activationId: aid() });
  expectOk(send(r, { type: 'APPLY_PREPARATION', id: 'prep_put_back_note', activationId: aid() }), 'put back');
  assert.deepEqual(r.s.entities.find(e => e.id === 'note')!.owner, { kind: 'location', id: 'room_a' });
  // Never someone else's belonging: an object held by another actor is out of reach.
  const m = foundationManifest();
  m.initialEntities[3].owner = { kind: 'actor', id: 'other' };
  m.initialEntities[1].owner = { kind: 'location', id: 'room_a' };
  const r2 = start(m);
  expectRejected(send(r2, { type: 'APPLY_PREPARATION', id: 'prep_hold_note', activationId: aid() }), 'unavailable', 'taking another actor\'s object');
  assert.equal(r2.s.entities.find(e => e.id === 'other')!.state.x, undefined, 'another actor is never changed');
}
ok('Preparations are reversible, restore exactly, and cannot touch another actor or their belongings');

{
  // Modal and sheet interplay with the clock.
  const r = start();
  send(r, { type: 'OPEN_MODAL', id: 'settings' });
  assert.deepEqual(deriveScopes(r.s), ['modal']);
  assert.equal(movementEligible(r.s), false);
  expectRejected(send(r, { type: 'ACTIVATE_CONTEXT', activationId: aid() }), 'busy', 'Enter behind a modal');
  expectRejected(send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() }), 'busy', 'observation behind a modal');
  send(r, { type: 'PAUSE', reason: 'hidden' });
  send(r, { type: 'CLOSE_MODAL' });
  assert.ok(isPaused(r.s.time, 'hidden'), 'closing a modal does not unpause a hidden tab');
  assert.equal(movementEligible(r.s), false, 'still not interactive while hidden');
  send(r, { type: 'RESUME', reason: 'hidden' });
  assert.equal(movementEligible(r.s), true);
  // Escape layering: modal first, then confirmation, observation, sheet, selection.
  send(r, { type: 'SELECT_TARGET', target: { kind: 'self' } });
  send(r, { type: 'OPEN_ACTIONS' });
  expectRejected(send(r, { type: 'SELECT_TARGET', target: { kind: 'self' } }), 'busy', 'select behind a sheet');
  send(r, { type: 'CANCEL' });
  assert.equal(r.s.sheet, undefined);
  assert.deepEqual(r.s.selectedTarget, { kind: 'self' }, 'the first Escape closed only the sheet');
  send(r, { type: 'CANCEL' });
  assert.equal(r.s.selectedTarget, undefined);
}
ok('Modal, sheet and selection layer correctly and a modal cannot unpause a hidden tab');

/* ============================================ 4. clock (interface only) ==== */

{
  let c = initialClock();
  c = pause(c, 'hidden');
  c = pause(c, 'modal', 'a');
  c = pause(c, 'modal', 'b');
  c = pause(c, 'modal', 'b'); // duplicate holder is harmless
  assert.equal(c.pauses.length, 3);
  c = resume(c, 'modal', 'a');
  assert.ok(isPaused(c, 'modal'), 'a second nested modal still holds the pause');
  c = resume(c, 'modal', 'b');
  assert.ok(!isPaused(c, 'modal'));
  assert.ok(isPaused(c, 'hidden'), 'closing modals cannot unpause a hidden tab');
  assert.equal(resume(c, 'reading'), c, 'resuming a reason nobody holds is a no-op');
  assert.equal(resume(c, 'hidden', 'someone_else'), c, 'only the owner can release');
  const readingOnly = pause(initialClock(), 'reading');
  assert.ok(isPaused(resume(readingOnly, 'modal'), 'reading'), 'a different reason cannot unpause reading');
  // Time domains.
  let t = initialClock();
  t = tick(t, 100);
  assert.deepEqual([t.presentationMs, t.narrativeMs, t.opportunityMs], [100, 100, 0], 'opportunity time never advances: no timers');
  t = tick(pause(t, 'reading'), 100);
  assert.deepEqual([t.presentationMs, t.narrativeMs], [200, 100], 'reading holds narrative time; ambient presentation may breathe');
  t = tick(pause(resume(t, 'reading'), 'hidden'), 100);
  assert.deepEqual([t.presentationMs, t.narrativeMs], [200, 100], 'a hidden tab holds everything');
  assert.equal(tick(t, -5), t);
  assert.equal(tick(initialClock(), 5000).narrativeMs, 1000, 'a stall cannot dump a huge delta into the clock');
  assert.equal(tick({ ...initialClock('untimed') }, 100).opportunityMs, 0);
}
ok('Clock: pauses are keyed reason:owner, so reading/modal/hidden/transition cannot unpause one another; no countdown exists');

/* ==================================================== 5. resume ========= */

{
  const r = start();
  send(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(r, { type: 'CLOSE_OBSERVATION' });
  const saved = JSON.parse(JSON.stringify(r.s));
  const back = restoreSnapshot(r.m, saved)!;
  assert.ok(back, 'a stored snapshot restores');
  assert.deepEqual(back.receivedFacts, ['f1']);
  assert.equal(back.phase, 'playing');
  // Corrupted or foreign snapshots are refused, never half-applied.
  for (const bad of [
    null, 5, {}, { ...saved, snapshotVersion: 2 }, { ...saved, manifestRevision: 'r2' }, { ...saved, decisionVersion: 'dv2' }, { ...saved, scene: 'nope' },
    { ...saved, location: 'room_b' }, { ...saved, arcIndex: 9 }, { ...saved, receivedFacts: ['ghost'] }, { ...saved, visitedScenes: ['ghost'] }, { ...saved, entities: [] }, { ...saved, deliveredBeats: [1] }, { ...saved, decision: { id: 'd_main', option: 'ghost', status: 'accepted' } },
  ]) assert.equal(restoreSnapshot(r.m, bad), undefined);
  // In-flight state is normalised: a half-open confirmation does not resume.
  toDecision(r);
  send(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() });
  const mid = restoreSnapshot(r.m, JSON.parse(JSON.stringify(r.s)))!;
  assert.equal(mid.phase, 'playing');
  assert.equal(mid.reservation, undefined);
  // An accepted act stays accepted and never returns to a choice.
  send(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() });
  const done = restoreSnapshot(r.m, JSON.parse(JSON.stringify(r.s)))!;
  assert.equal(done.phase, 'boundary');
  assert.deepEqual(done.decision, { id: 'd_main', option: 'act_speak', status: 'accepted' });
  assert.equal(done.boundaryLocked, true);
  expectRejected(send({ m: r.m, s: done, log: [] }, { type: 'REQUEST_INTENT', id: 'act_wait', activationId: aid() }), 'decision_closed', 'resume cannot reopen the choice');
  // A pending transition resumes at its source.
  const t = start();
  send(t, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  send(t, { type: 'CLOSE_OBSERVATION' });
  send(t, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() });
  const tr = restoreSnapshot(t.m, JSON.parse(JSON.stringify(t.s)))!;
  assert.equal(tr.scene, 'scene_a');
  assert.equal(tr.phase, 'playing');
  assert.equal(tr.transition, undefined);
}
ok('Snapshots restore only when valid for this manifest revision; in-flight state is normalised and an accepted act stays accepted');

/* ================================================ 6. readable path ======= */

{
  // Drive the whole experience using nothing but the readable model and its events: no coordinates, no pointer.
  const r = start();
  const guard = () => assert.ok(act < 10_000);
  const pick = <T extends { available: boolean }>(xs: T[]) => xs.find(x => x.available);
  const prep = buildReadableModel(r.m, r.s).preparations.find(p => p.available && !p.applied);
  assert.ok(prep, 'a preparation is listed');
  expectOk(send(r, readableEvents.prepare(prep!.id, aid())), 'prepare via readable');
  assert.ok(buildReadableModel(r.m, r.s).preparations.find(p => p.id === prep!.id)!.applied);
  expectOk(send(r, readableEvents.undoPreparation(prep!.id)), 'and undo it via readable');
  assert.ok(!buildReadableModel(r.m, r.s).preparations.find(p => p.id === prep!.id)!.applied);
  for (let i = 0; i < 40 && r.s.phase === 'playing' && r.s.scene !== 'scene_c'; i++) {
    guard();
    const model = buildReadableModel(r.m, r.s);
    const o = model.observations.find(x => x.available && !x.seen);
    if (o) {
      expectOk(send(r, readableEvents.observe(o.id, aid())), 'observe via readable');
      send(r, readableEvents.cancel());
      continue;
    }
    if (model.canAdvance) {
      expectOk(send(r, readableEvents.advance(aid())), 'advance via readable');
      continue;
    }
    const p = pick(model.portals);
    assert.ok(p, 'there is always a way forward in the readable model');
    const req = send(r, readableEvents.travel(p!.id, aid()));
    expectOk(req, 'travel via readable');
    send(r, { type: 'TRANSITION_READY', txId: (req.effects[0] as any).txId });
    send(r, { type: 'ENTERED' });
  }
  assert.equal(r.s.scene, 'scene_c');
  expectOk(send(r, readableEvents.advance(aid())), 'the quote');
  const model = buildReadableModel(r.m, r.s);
  assert.deepEqual(model.actions.map(a => a.id).sort(), ['act_ask', 'act_speak', 'act_wait'], 'the same options as the pointer path');
  assert.ok(model.actions.every(a => a.available && a.motive.length > 0 && !a.blockedBy));
  assert.deepEqual(model.facts.map(f => f.id).sort(), ['f0', 'f1', 'f2', 'f3', 'f4', 'f5'], 'received facts are inspectable, with their text');
  assert.ok(model.facts.every(f => f.text.length > 0));
  assert.deepEqual(model.pendingRequiredFacts, []);
  expectOk(send(r, readableEvents.chooseAct('act_wait', aid())), 'choose');
  assert.equal(buildReadableModel(r.m, r.s).decision.status, 'reserved');
  expectOk(send(r, readableEvents.confirmAct('act_wait', aid())), 'confirm');
  const done = buildReadableModel(r.m, r.s);
  assert.equal(done.decision.status, 'accepted');
  assert.equal(done.decision.accepted, 'act_wait');
  assert.ok(done.actions.every(a => !a.available && a.blockedBy === 'decided'), 'after the act the others are closed');
  assert.ok(!done.canAdvance);
  assert.ok(done.observations.every(o => !o.available), 'nothing is actionable once locked');
  // Outside the decision scene there are no acts to list.
  assert.deepEqual(buildReadableModel(foundationManifest(), start().s).actions, []);
  // Explains what is missing and why a portal is blocked.
  const fresh = buildReadableModel(foundationManifest(), start().s);
  assert.equal(fresh.portals[0].available, false);
  assert.equal(fresh.portals[0].blockedBy, 'gate');
  assert.deepEqual(fresh.pendingRequiredFacts, ['f0', 'f1']);
  assert.equal(fresh.canAdvance, true);
}
ok('Every required action is reachable from the readable model alone: observations, facts, portals, preparations, advance and the same decision');

/* ==================================================== 7. loader ========== */

{
  const post = deepFreeze(foundationPost());
  const before = JSON.stringify(post);
  const v3 = loadPlayable(post);
  assert.equal(v3.kind, 'v3');
  if (v3.kind === 'v3') {
    assert.equal(v3.post, post, 'the stored object is returned as it is');
    assert.deepEqual(v3.versions, { postSchema: 3, runtimeManifest: 3, semanticSchema: 3, compiler: '0.0.0-fixture', assetRevisions: { kit_neutral: 'r1' } });
    assert.equal(v3.manifest.revision, 'r1');
  }
  assert.equal(JSON.stringify(post), before, 'loading V3 does not mutate it');

  const bad: any = foundationPost();
  bad.playback.facts[0].id = 'BAD ID';
  const inv = loadPlayable(bad);
  assert.equal(inv.kind, 'invalid_v3');
  if (inv.kind === 'invalid_v3') assert.ok(inv.issues.length > 0 && !inv.summary.includes('BAD ID'));

  for (const [label, item, reason] of [
    ['future post schema', { ...foundationPost(), postSchemaVersion: 4 }, 'future_post_schema'],
    ['non-numeric post schema', { ...foundationPost(), postSchemaVersion: 'three' }, 'unknown_post_schema'],
    ['schema 1 marker', { ...foundationPost(), postSchemaVersion: 1 }, 'unknown_post_schema'],
    ['future runtime manifest', (() => { const p: any = foundationPost(); p.playback.runtimeManifestVersion = 4; return p; })(), 'future_manifest_version'],
    ['future semantic schema', (() => { const p: any = foundationPost(); p.playback.semanticSchemaVersion = 4; return p; })(), 'future_manifest_version'],
    ['a bare manifest with no post marker', foundationManifest(), 'unrecognised_shape'],
    ['a future V2-style schema', { id: 'x', schemaVersion: 3, scenario: { id: 'x' } }, 'future_post_schema'],
    ['an unknown schemaVersion', { id: 'x', schemaVersion: 'a', scenario: {} }, 'unknown_post_schema'],
    ['null', null, 'unrecognised_shape'],
    ['an array', [], 'unrecognised_shape'],
    ['a string', 'post', 'unrecognised_shape'],
    ['an empty object', {}, 'unrecognised_shape'],
    ['an object with only an id', { id: 'x' }, 'unrecognised_shape'],
  ] as const) {
    const r = loadPlayable(item);
    assert.equal(r.kind, 'unsupported', `${label}: must fail safely`);
    assert.equal((r as any).reason, reason, label);
  }
}
ok('The loader routes V3 explicitly, rejects invalid V3 and fails safely on unknown or future schemas');

{
  // Legacy compatibility: the existing path is untouched.
  const spec = deepFreeze(clone(SOCIAL_MEMORIES[0]));
  const specBefore = JSON.stringify(spec);
  const g = loadPlayable(spec);
  assert.equal(g.kind, 'legacy_game_spec');
  assert.equal((g as any).game, spec, 'a legacy GameSpec is returned untouched, by reference');
  assert.equal(JSON.stringify(spec), specBefore);

  const fixture = experienceFixtureById['v2-apartment-ru'] ?? Object.values(experienceFixtureById)[0];
  const compiled = await compileFixture(fixture);
  const v2 = deepFreeze(compiled.post);
  const v2Before = JSON.stringify(v2);
  const l = loadPlayable(v2);
  assert.equal(l.kind, 'legacy_stored_post', 'a V1/V2 post goes down the existing path');
  assert.equal((l as any).post, v2, 'by reference: nothing is copied, upgraded or reinterpreted');
  assert.equal(JSON.stringify(v2), v2Before, 'the stored post is not mutated');
  assert.equal(v2.schemaVersion, 2);
  // Loader routing agrees with the predicate the app has always used for V2.
  for (const item of [v2, spec, foundationPost(), {}, null]) {
    const isV2 = !!item && typeof item === 'object' && (item as any).schemaVersion === 2 && typeof (item as any).scenario?.id === 'string';
    assert.equal(loadPlayable(item).kind === 'legacy_stored_post', isV2);
  }
  // Every seeded archive item still routes to the legacy path.
  for (const s of SOCIAL_MEMORIES) assert.equal(loadPlayable(s).kind, 'legacy_game_spec');
}
ok('Legacy compatibility: V1/V2 posts and GameSpecs route as before, by reference, unmutated');

/* ===================================================== 8. input table ==== */

{
  const key = (p: Partial<KeyFacts> & Pick<KeyFacts, 'key' | 'code'>): KeyFacts => ({ type: 'keydown', repeat: false, isComposing: false, ctrl: false, meta: false, alt: false, shift: false, ...p });
  const ctx = (p: Partial<RouteContext> = {}): RouteContext => ({ target: 'world_surface', scopes: [], movementEligible: true, ...p });
  const down = key({ key: 'ArrowDown', code: 'ArrowDown' });

  // The world surface owns movement keys.
  let r = routeKeydown(down, ctx());
  assert.deepEqual([r.owner, r.preventDefault, r.action], ['world', true, { kind: 'move_down', code: 'ArrowDown' }]);
  for (const [k, c] of [['ArrowUp', 'ArrowUp'], ['ArrowLeft', 'ArrowLeft'], ['ArrowRight', 'ArrowRight'], ['w', 'KeyW'], ['a', 'KeyA'], ['s', 'KeyS'], ['d', 'KeyD'], ['ц', 'KeyW'], ['ф', 'KeyA'], ['ы', 'KeyS'], ['в', 'KeyD']]) {
    r = routeKeydown(key({ key: k, code: c }), ctx());
    assert.deepEqual([r.preventDefault, r.action.kind], [true, 'move_down'], `${k}/${c}: physical position, any layout`);
  }
  assert.equal(routeKeydown(down, ctx()).preventDefault, true);
  r = routeKeydown(key({ key: 'ArrowDown', code: 'ArrowDown', repeat: true }), ctx());
  assert.deepEqual([r.preventDefault, r.action.kind], [true, 'move_down'], 'a repeated arrow is still ours, so the page never scrolls on repeat');
  // Owned but not possible: consumed, hinted, never scrolls.
  r = routeKeydown(down, ctx({ movementEligible: false }));
  assert.deepEqual([r.preventDefault, r.action.kind], [true, 'blocked']);
  for (const scope of ['modal', 'intent_sheet', 'observation', 'transition'] as const) {
    r = routeKeydown(down, ctx({ scopes: [scope] }));
    assert.deepEqual([r.preventDefault, r.action.kind], [true, 'blocked'], `${scope}: no locomotion, and the surface still does not scroll`);
  }
  // Everywhere else: native.
  for (const target of ['native_control', 'other'] as const) {
    r = routeKeydown(down, ctx({ target }));
    assert.deepEqual([r.preventDefault, r.action.kind], [false, 'none'], `${target}: the browser keeps the arrow`);
    r = routeKeydown(key({ key: 'w', code: 'KeyW' }), ctx({ target }));
    assert.deepEqual([r.preventDefault, r.action.kind], [false, 'none']);
  }
  r = routeKeydown(down, ctx({ target: 'editable' }));
  assert.deepEqual([r.owner, r.preventDefault, r.action.kind], ['text_entry', false, 'none'], 'typing is never movement');
  for (const k of ['w', 'a', 's', 'd']) assert.equal(routeKeydown(key({ key: k, code: `Key${k.toUpperCase()}` }), ctx({ target: 'editable' })).action.kind, 'none');
  // Modifiers, IME and dead keys.
  for (const m of ['ctrl', 'meta', 'alt', 'shift'] as const) assert.deepEqual([routeKeydown({ ...down, [m]: true }, ctx()).preventDefault, routeKeydown({ ...down, [m]: true }, ctx()).action.kind], [false, 'none'], `${m}+Arrow stays native`);
  assert.equal(routeKeydown({ ...down, isComposing: true }, ctx()).preventDefault, false);
  assert.equal(routeKeydown(key({ key: 'Process', code: 'KeyW' }), ctx()).action.kind, 'none');
  assert.equal(routeKeydown(key({ key: 'Dead', code: 'KeyA' }), ctx()).action.kind, 'none');

  // Enter: one defined meaning in the world; native everywhere else.
  const enter = key({ key: 'Enter', code: 'Enter' });
  r = routeKeydown(enter, ctx());
  assert.deepEqual([r.owner, r.preventDefault, r.action.kind], ['world', true, 'activate']);
  r = routeKeydown({ ...enter, repeat: true }, ctx());
  assert.deepEqual([r.preventDefault, r.action.kind], [true, 'none'], 'a held Enter is swallowed: one press, one command');
  for (const target of ['native_control', 'other', 'editable'] as const) {
    r = routeKeydown(enter, ctx({ target }));
    assert.deepEqual([r.preventDefault, r.action.kind], [false, 'none'], `Enter on ${target} is native activation, untouched`);
  }
  for (const scope of ['modal', 'intent_sheet', 'observation', 'transition'] as const) assert.equal(routeKeydown(enter, ctx({ scopes: [scope] })).action.kind, 'none', `Enter is not a world command behind ${scope}`);
  assert.equal(routeKeydown({ ...enter, shift: true }, ctx()).action.kind, 'none');
  assert.equal(routeKeydown(key({ key: ' ', code: 'Space' }), ctx()).preventDefault, false, 'Space is never bound');
  assert.equal(routeKeydown(key({ key: 'Tab', code: 'Tab' }), ctx()).preventDefault, false, 'Tab always leaves');
  assert.equal(routeKeydown(key({ key: 'Tab', code: 'Tab', shift: true }), ctx()).preventDefault, false);

  // Escape closes the highest closable scope; transition/enactment cannot be undone.
  const esc = key({ key: 'Escape', code: 'Escape' });
  for (const [scopes, target] of [
    [['modal', 'intent_sheet'], 'native_control'],
    [['intent_sheet', 'observation'], 'other'],
    [['observation'], 'world_surface'],
  ] as const) {
    r = routeKeydown(esc, ctx({ scopes: scopes as any, target }));
    assert.deepEqual([r.preventDefault, r.action], [true, { kind: 'cancel', scope: scopes[0] }], `Escape closes ${scopes[0]} first`);
  }
  r = routeKeydown(esc, ctx({ target: 'editable', scopes: ['modal'] }));
  assert.deepEqual(r.action, { kind: 'cancel', scope: 'modal' }, 'a dialog can still be dismissed from its own field');
  assert.equal(routeKeydown(esc, ctx({ target: 'editable' })).action.kind, 'none', 'Escape in a field outside any dialog is the editor\'s');
  assert.equal(routeKeydown({ ...esc, isComposing: true }, ctx({ target: 'editable', scopes: ['modal'] })).action.kind, 'none', 'IME Escape belongs to the IME');
  assert.equal(routeKeydown({ ...esc, repeat: true }, ctx({ scopes: ['modal'] })).action.kind, 'none', 'a held Escape does not cascade through every layer');
  assert.deepEqual(routeKeydown(esc, ctx()).action, { kind: 'cancel', scope: 'world' });
  assert.equal(routeKeydown(esc, ctx({ scopes: ['transition'] })).action.kind, 'none', 'no undo during enactment');
  assert.equal(routeKeydown(esc, ctx({ target: 'native_control' })).action.kind, 'none');

  assert.equal(movementCode({ key: 'ArrowUp', code: '' }), 'ArrowUp');
  assert.equal(movementCode({ key: 'w', code: '' }), undefined, 'letters are recognised only by physical code');
  assert.deepEqual(movementVector(new Set(['ArrowUp'])), [0, -1]);
  assert.deepEqual(movementVector(new Set(['ArrowRight', 'KeyA'])), [0, 0], 'opposites cancel');
  const [dx, dy] = movementVector(new Set(['KeyD', 'ArrowDown']));
  assert.ok(Math.abs(Math.hypot(dx, dy) - 1) < 0.01, 'diagonals are normalised');
}
ok('Input ownership table: movement, Enter, Escape, Tab, editors, modifiers, IME and scope priority');

/* ============================== 9. runtime stays model-free and generic === */

{
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(p)) files.push(p);
    }
  };
  for (const d of ['src/engine/v3', 'src/engine/input', 'src/components/experience/v3']) walk(d);
  assert.ok(files.length > 10);
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    const imports = [...src.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map(m => m[1]);
    for (const i of imports) {
      assert.ok(!/@google\/genai|openai|openrouter|anthropic|semanticProvider|geminiProvider|\/server\//i.test(i), `${f} must not import a model/provider module (${i})`);
    }
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${f} must not touch the network`);
    assert.ok(!/localStorage|sessionStorage/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${f} must not persist on its own`);
    if (!f.includes('/testing/')) assert.ok(!/the[_ -]?correction|spare[_ -]?key|the[_ -]?introduction/i.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${f} must not special-case a story`);
  }
}
ok('The V3 runtime imports no model/provider module, makes no network or storage calls, and special-cases no story');

console.log(`\nAll ${n} V3 foundation checks passed.`);
