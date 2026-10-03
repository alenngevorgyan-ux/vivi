import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import semanticSpec from '../src/data/experienceV3Fixtures/spec/the-correction.semantic.json' with { type: 'json' };
import privateReveal from '../src/data/experienceV3Fixtures/spec/the-correction.reveal.private.json' with { type: 'json' };
import type { PlaybackManifestV3, StoredPostV3 } from '../src/engine/v3/contracts/manifest.ts';
import type { RuntimeSnapshot } from '../src/engine/v3/contracts/state.ts';
import { findPrivateLeaks, validateManifest, validateSemanticPlan, validateStoredPostV3, type ValidationIssue } from '../src/engine/v3/contracts/validate.ts';
import { createExperience, deriveScopes, restoreSnapshot, step } from '../src/engine/v3/ExperienceController.ts';
import { buildReadableModel, readableEvents, type ReadableModel } from '../src/engine/v3/readable.ts';
import { loadPlayable } from '../src/engine/v3/compat/loadPlayable.ts';
import { routeKeydown, type KeyFacts, type RouteContext } from '../src/engine/input/routing.ts';
import { foundationManifest } from '../src/engine/v3/testing/foundationFixture.ts';
import { projectVisualHooks, type PresentationSettings } from '../src/components/experience/v3/visualHooks.ts';
import { AdaptationError, adaptGoldSpec, type GoldEnvelope } from '../src/data/experienceV3Fixtures/runtime/adaptGoldSpec.ts';
import { compileFixturePlan, type GeometryExport } from '../src/data/experienceV3Fixtures/runtime/compileFixturePlan.ts';
import {
  CORRECTION_ENVELOPE,
  CORRECTION_VARIANTS,
  CORRECTION_VERSIONS,
  correctionAdaptation,
  correctionGeometry,
  correctionManifest,
  correctionPost,
  correctionSemanticPlan,
  type CorrectionVariant,
} from '../src/data/experienceV3Fixtures/runtime/theCorrection.ts';
import { CORRECTION_REVEAL_CANARIES, CORRECTION_REVEAL_PRESENTATION, correctionReveal, correctionRevealBinding, resolveCorrectionReveal } from '../src/data/experienceV3Fixtures/runtime/theCorrection.reveal.ts';
import { CORRECTION_SOURCE_LEDGER, traceCorrectionFacts } from '../src/data/experienceV3Fixtures/runtime/theCorrection.provenance.ts';
import { correctionActSlots, correctionAmbientCues, correctionSceneSlots, SCENE_HOOKS } from '../src/data/experienceV3Fixtures/runtime/theCorrection.presentation.ts';
import { PLACEHOLDER_GEOMETRY_ID } from '../src/data/experienceV3Fixtures/runtime/placeholderGeometry.ts';
import { HeadlessHost } from './lib/v3HeadlessHost.ts';
import { CORRECTION_OPTIONS, advance, canonicalRun, commit, correctionHost, expectOk, expectRejected, finish, observe, ok, travel, walkToDecision } from './lib/correctionWalk.ts';
import { correctionTrace } from './trace-v3-correction.ts';

/**
 * THE CORRECTION — first-slice HEADLESS integration.
 *
 * Proves that the gold-1 story runs through the real V3 Foundation contracts and
 * controller: adaptation, provenance, public/private separation, a full walk,
 * A→B→A persistence, rich/compressed and readable parity, story-level input
 * rules, placeholder geometry, the visual handshake, the dev trace and a red
 * team. It proves technical invariants only — never atmosphere, engagement,
 * hallway value, visual quality, reveal impact or understanding.
 */

console.log('Testing THE CORRECTION through the V3 Foundation (headless)...\n');
let n = 0;
const passed = (label: string) => console.log(`✓ ${++n}. ${label}`);

/* ------------------------------------------------------------ helpers --- */

const clone = <T,>(x: T): T => structuredClone(x);
const has = (issues: readonly ValidationIssue[], code: string) => issues.some(i => i.code === code);
const F = (goldId: string) => goldId.toLowerCase();
const REQUIRED_GOLD = semanticSpec.evidenceFacts.filter(f => f.required).map(f => f.id);
const REQUIRED = REQUIRED_GOLD.map(F);
const MINIMUM = semanticSpec.primaryDecision.minimumKnowledge.map(F);
const OPTIONAL = semanticSpec.evidenceFacts.filter(f => !f.required).map(f => F(f.id));
const sorted = (xs: readonly string[]) => [...xs].sort();
/** The live snapshot, un-narrowed (assert.* narrows property paths such as `h.s.receivedFacts`). */
const snap = (h: HeadlessHost): RuntimeSnapshot => h.s;
const SETTINGS: PresentationSettings = { reducedMotion: false, highContrast: false, audio: { unlocked: false, muted: true } };
const noLeaks = (value: unknown, what: string) => assert.deepEqual(findPrivateLeaks(value, CORRECTION_REVEAL_CANARIES), [], `${what} carries no author act/why/aftermath`);
const allKeys = (v: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(v)) v.forEach(x => allKeys(x, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) (out.add(k), allKeys(x, out));
  return out;
};
const owners = (s: RuntimeSnapshot) => Object.fromEntries(s.entities.map(e => [e.id, e.owner.kind === 'offstage' ? 'offstage' : `${e.owner.kind}:${e.owner.id}`]));
const key = (k: string, extra: Partial<KeyFacts> = {}): KeyFacts => ({ type: 'keydown', key: k, code: '', repeat: false, isComposing: false, ctrl: false, meta: false, alt: false, shift: false, ...extra });
const worldCtx = (s: RuntimeSnapshot, m: PlaybackManifestV3): RouteContext => ({ target: 'world_surface', scopes: deriveScopes(s), movementEligible: s.phase === 'playing' && !buildReadableModel(m, s).decision.reserved });

/* ===================================================== 1. contract ==== */

for (const v of CORRECTION_VARIANTS) {
  const { plan } = correctionSemanticPlan(v);
  const sp = validateSemanticPlan(plan, { profile: 'launch' });
  assert.ok(sp.ok, `${v} semantic plan: ${!sp.ok && JSON.stringify(sp.issues)}`);
  const m = correctionManifest(v);
  const mv = validateManifest(m, { profile: 'launch' });
  assert.ok(mv.ok, `${v} manifest: ${!mv.ok && JSON.stringify(mv.issues)}`);
  const post = correctionPost(v);
  assert.ok(validateStoredPostV3(post, { profile: 'launch' }).ok);
  const loaded = loadPlayable(post);
  assert.equal(loaded.kind, 'v3', `${v} loads through the ordinary V3 loader`);
  if (loaded.kind === 'v3') {
    assert.equal(loaded.versions.compiler, CORRECTION_VERSIONS.compilerVersion);
    assert.deepEqual(loaded.versions.assetRevisions, { dev_placeholder_office_kit: PLACEHOLDER_GEOMETRY_ID });
  }
  assert.equal(m.experienceId, 'the-correction');
  assert.equal(m.revision, CORRECTION_VERSIONS.manifest[v].revision);
  assert.equal(m.decisionVersion, CORRECTION_VERSIONS.manifest[v].decisionVersion);
  assert.equal(post.revealRef, CORRECTION_VERSIONS.revealRef);
  // Built twice, byte-identical: the adaptation is deterministic.
  assert.equal(JSON.stringify(correctionManifest(v)), JSON.stringify(m));
}
{
  const rich = correctionManifest('rich');
  assert.deepEqual(rich.spine, ['c_desk', 'c_meeting_before', 'c_hallway', 'c_meeting_question'], 'gold-1 four views');
  assert.deepEqual([...new Set(rich.scenePlans.map(s => s.location))], ['desk', 'meeting', 'hallway'], 'three locations');
  assert.deepEqual(rich.portals.map(p => `${p.id}:${p.kind}:${p.fromScene}>${p.toScene}`), [
    'cut_to_meeting:spine:c_desk>c_meeting_before',
    'start_break:spine:c_meeting_before>c_hallway',
    'resume_meeting:spine:c_hallway>c_meeting_question',
    'p_hall:excursion:c_meeting_before>c_hallway',
    'p_room:excursion:c_hallway>c_meeting_before',
  ]);
  const cmp = correctionManifest('compressed');
  assert.deepEqual(cmp.spine, ['c_compressed_before', 'c_compressed_meeting'], 'gold §M two frames');
  assert.deepEqual([...new Set(cmp.scenePlans.map(s => s.location))], ['meeting'], 'one meeting location');
  assert.deepEqual(cmp.portals.map(p => p.id), ['cut_to_meeting'], 'no walkable hallway in the control');
  assert.notEqual(rich.decisionVersion, cmp.decisionVersion, 'control first choices are a separate cell, never pooled');
}
passed('Both variants adapt, validate (launch profile) and load through the ordinary V3 loader with explicit revisions');

/* ============================================== 2. gold → runtime map === */

{
  const m = correctionManifest('rich');
  const kind: Record<string, string> = { relationship: 'observed', context: 'observed', observed: 'observed', belief: 'hero_belief', quote: 'quoted_speech', timing: 'timing' };
  assert.equal(m.facts.length, semanticSpec.evidenceFacts.length);
  for (const g of semanticSpec.evidenceFacts) {
    const r = m.facts.find(f => f.id === F(g.id));
    assert.ok(r, `${g.id} is a runtime fact`);
    assert.equal(r.text, g.claim, `${g.id} keeps the approved claim verbatim`);
    assert.equal(r.kind, kind[g.type], `${g.id} kind`);
  }
  for (const g of semanticSpec.scenes) {
    const s = m.scenePlans.find(x => x.id === g.id)!;
    assert.deepEqual(s.requiredFacts, g.requiredFacts.map(F), `${g.id} required facts`);
    assert.deepEqual(s.beats.map(b => b.id), g.beats, `${g.id} events in gold order`);
    assert.deepEqual(s.observationIds, g.observationIds);
    assert.deepEqual(s.opportunityIds, g.opportunityIds);
    assert.equal(s.purpose, g.purpose);
    assert.ok(s.beats.every(b => b.delivery === 'reader'), 'every delivery holds for reading; no timer');
  }
  for (const g of semanticSpec.opportunities) {
    const o = m.opportunities.find(x => x.id === g.id)!;
    assert.deepEqual([o.verb, o.label, o.motive, o.target], [g.verb, g.label, g.motive, g.target]);
    assert.deepEqual(o.fearedCostFacts, g.fearedCostFacts.map(F));
    assert.deepEqual(o.feasibilityFacts, g.feasibilityFacts.map(F));
  }
  assert.deepEqual(m.primaryDecision, { id: 'd_the_correction_1', scene: 'c_meeting_question', minimumKnowledge: MINIMUM, options: ['correct_public', 'request_private', 'pass_question'] });
  assert.ok(!MINIMUM.includes('f10'), 'F10 stays optional');
  assert.deepEqual(m.truthBoundary, { scene: 'c_meeting_question', after: 'primary_act' });
  // Live speech is exactly the director's two quotes; Mira's promise is yesterday's, narrated (gold §D).
  const quotes = m.scenePlans.flatMap(s => s.beats.flatMap(b => b.events)).filter(e => e.kind === 'quote');
  assert.deepEqual(quotes, [{ kind: 'quote', actor: 'a_director', fact: 'f06' }, { kind: 'quote', actor: 'a_director', fact: 'f11' }]);
  assert.ok(m.scenePlans[0].beats[0].events.some(e => e.kind === 'deliver' && e.facts.includes('f04')));
  // Ownership as gold §F.
  assert.deepEqual(owners(createExperience(m, { attemptId: 'x' })), {
    a_me: 'location:desk', a_mira: 'location:meeting', a_director: 'location:meeting', o_deck: 'location:desk', o_slide: 'location:meeting', o_summary: 'actor:a_me',
  });
  // Every interpretation the adapter applied is pinned here; changing one is a reviewed decision, not drift.
  assert.deepEqual(correctionSemanticPlan('rich').trace, {
    facts: Object.fromEntries(semanticSpec.evidenceFacts.map(f => [F(f.id), f.id])),
    scenes: { c_desk: ['c_desk'], c_meeting_before: ['c_meeting_before'], c_hallway: ['c_hallway'], c_meeting_question: ['c_meeting_question'] },
    droppedGates: ['opportunities.correct_public[0]', 'opportunities.request_private[0]', 'opportunities.pass_question[0]'],
    structuralGates: ['observations.obs_title'],
    mergedTransitions: [],
    narratedVariables: [],
    overrides: ['preparations.prep_seat', 'preparations.prep_near'],
  });
  // The gold spec itself was only read: byte-identical to the Format Proof pack (028e400).
  const GOLD_FILES: Record<string, string> = {
    'the-correction.semantic.json': '2c7316252ec3855d55440012297363ff39ecad951fd59ff95b90f82a7e6588ab',
    'the-correction.source.private.json': 'aef9871cb42bc52dc5737ee429a517e8d19321d4ba09ff495b72c00b2af14c1d',
    'the-correction.reveal.private.json': '23fe947dab045a356137ffd2bc1c6d367bbb4ae525c26c694c740213b926588c',
  };
  for (const [file, sha] of Object.entries(GOLD_FILES)) assert.equal(createHash('sha256').update(readFileSync(`src/data/experienceV3Fixtures/spec/${file}`)).digest('hex'), sha, `${file} unchanged`);
}
passed('Gold → runtime map: 14 facts verbatim, scenes/events in gold order, acts, decision, boundary, ownership and every adapter interpretation pinned');

/* =================================================== 3. provenance ===== */

{
  const ledger = CORRECTION_SOURCE_LEDGER;
  // The ledger itself is intact: hash and code-point offsets reproduce every excerpt.
  assert.equal(createHash('sha256').update(ledger.normalizedPreBoundary, 'utf8').digest('hex'), CORRECTION_VERSIONS.sourceSha256);
  assert.equal(ledger.sourceSha256, CORRECTION_VERSIONS.sourceSha256);
  const cps = [...ledger.normalizedPreBoundary.normalize('NFC')];
  for (const s of ledger.spans) assert.equal(cps.slice(s.startCodePoint, s.endCodePoint).join(''), s.excerpt, `${s.id} offsets`);

  for (const v of CORRECTION_VARIANTS) {
    const m = correctionManifest(v);
    const { trace, missing } = traceCorrectionFacts(m);
    assert.deepEqual(missing, [], `${v}: every runtime fact has a gold source`);
    assert.equal(trace.facts.length, m.facts.length);
    for (const t of trace.facts) {
      assert.equal(m.facts.find(f => f.id === t.runtimeFact)!.text, t.claim, `${t.goldFact}: runtime text is the approved claim`);
      assert.ok(t.spans.length > 0 && t.spans.every(s => /^S\d\d$/.test(s.id)), `${t.goldFact}: pre-boundary spans only`);
      // The semantic plan's span ids are the ledger's (the public adapter never reads the ledger).
      const claim = correctionSemanticPlan(v).plan.claims.find(c => c.id === t.runtimeFact)!;
      assert.deepEqual(claim.sourceSpanIds, t.spans.map(s => s.id.toLowerCase()));
      const fact = m.facts.find(f => f.id === t.runtimeFact)!;
      if (fact.kind === 'quoted_speech') {
        const quoted = /“([^”]+)”/.exec(fact.text)![1];
        assert.ok(t.spans.some(s => s.excerpt.includes(`“${quoted}”`)), `${t.goldFact}: quote is verbatim in its span`);
      }
    }
    noLeaks(trace, `${v} provenance trace`);

    // Every other visible string is either gold envelope text or a verbatim substring of an approved span.
    const goldStrings = new Set<string>();
    const collect = (x: unknown) => {
      if (typeof x === 'string') goldStrings.add(x);
      else if (Array.isArray(x)) x.forEach(collect);
      else if (x && typeof x === 'object') Object.values(x).forEach(collect);
    };
    collect(semanticSpec);
    const visible = [
      ...m.facts.map(f => f.text),
      ...m.portals.map(p => p.label),
      ...m.observations.map(o => o.label),
      ...m.preparations.map(p => p.label),
      ...m.opportunities.flatMap(o => [o.label, o.motive]),
      ...m.compiledScenes.flatMap(c => c.accessibleText.map(a => a.text)),
      m.tension!.description,
      ...m.tension!.poles.map(p => p.motive),
      ...m.tension!.unknowns,
      m.stagingDisclosure,
    ];
    for (const text of visible) {
      const sourced = goldStrings.has(text) || ledger.spans.some(s => s.excerpt.toLowerCase().includes(text.toLowerCase()));
      assert.ok(sourced, `${v}: visible text has a gold source: ${text.slice(0, 40)}`);
    }
  }
  // A runtime fact without a ledger entry is reported, never silently traced.
  const rogue = correctionManifest('rich');
  rogue.facts.push({ id: 'f99', text: 'An unsourced claim.', kind: 'observed' });
  assert.deepEqual(traceCorrectionFacts(rogue).missing, ['f99']);
  // The adapter's span table equals the private ledger's.
  for (const f of ledger.evidenceFacts) assert.deepEqual(correctionAdaptation('rich').factSpans[f.id], f.sourceSpanIds, `${f.id} spans`);
}
passed('Provenance: every runtime fact → gold fact → pre-boundary span (hash/offsets verified); every visible string sourced; rogue facts reported');

/* ==================================== 4. public / private separation ==== */

{
  // The canaries are real reveal text and never occur in the public gold envelope.
  assert.deepEqual(findPrivateLeaks(semanticSpec, CORRECTION_REVEAL_CANARIES), [], 'canaries are absent from the gold public projection');
  assert.ok(CORRECTION_REVEAL_CANARIES.length >= 3);
  for (const v of CORRECTION_VARIANTS) {
    noLeaks(correctionManifest(v), `${v} manifest`);
    noLeaks(correctionPost(v), `${v} post`);
    noLeaks(correctionSemanticPlan(v), `${v} semantic plan + adaptation trace`);
    noLeaks(correctionSceneSlots(v), `${v} design slots`);
    const keys = allKeys(correctionPost(v));
    for (const k of ['act', 'why', 'aftermath', 'authorOption', 'authorHandle', 'choreography', 'revealSource', 'deliberatelyWithheld']) assert.ok(!keys.has(k), `${v} public post has no "${k}" key`);
  }
  noLeaks(correctionActSlots(), 'act design slots');

  // The reveal is a separate record, exactly the private gold text.
  const r = correctionReveal();
  assert.deepEqual([r.act, r.why, r.aftermath, r.authorOption, r.status], [privateReveal.act, privateReveal.why, privateReveal.aftermath, 'correct_public', 'fictional_editorial']);
  assert.deepEqual(findPrivateLeaks(r, CORRECTION_REVEAL_CANARIES).length, CORRECTION_REVEAL_CANARIES.length, 'the record is where every canary lives');
  assert.ok(privateReveal.choreography.transition.includes(CORRECTION_REVEAL_PRESENTATION.bridge), 'bridge copy is the gold bridge');
  assert.deepEqual(CORRECTION_REVEAL_PRESENTATION.sequence.map(x => `${x.field}:${x.entry}`), ['act:automatic', 'why:reader', 'aftermath:reader']);
  // Every variant resolves the SAME account; unknown revisions resolve nothing.
  for (const v of CORRECTION_VARIANTS) assert.deepEqual(resolveCorrectionReveal('the-correction', CORRECTION_VERSIONS.manifest[v].revision), r);
  assert.equal(resolveCorrectionReveal('the-correction', 'gold-2'), undefined);
  assert.equal(resolveCorrectionReveal('foundation_fixture', 'gold-1'), undefined);

  // Import graph: nothing reachable from the public module reads a private file; only the two private modules do.
  const importsOf = (file: string): string[] =>
    [...readFileSync(file, 'utf8').matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map(x => x[1]).filter(p => p.startsWith('.')).map(p => resolve(dirname(file), p));
  const reach = (file: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(file)) return seen;
    seen.add(file);
    if (file.endsWith('.ts')) for (const i of importsOf(file)) reach(i, seen);
    return seen;
  };
  const publicGraph = [...reach(resolve('src/data/experienceV3Fixtures/runtime/theCorrection.ts')), ...reach(resolve('src/components/experience/v3/visualHooks.ts'))];
  assert.ok(publicGraph.some(f => f.endsWith('the-correction.semantic.json')));
  assert.ok(!publicGraph.some(f => f.endsWith('.private.json')), 'the public manifest/hooks never import private source or reveal');
  const srcFiles: string[] = [];
  const walk = (d: string) => readdirSync(d).forEach(f => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : /\.(ts|tsx)$/.test(f) && srcFiles.push(join(d, f))));
  walk('src');
  for (const f of srcFiles) {
    const src = readFileSync(f, 'utf8');
    const privateImport = /\.private\.json['"]/.test(src);
    if (privateImport) assert.ok(/theCorrection\.(reveal|provenance)\.ts$/.test(f), `${f} must not import a private gold file`);
    if (!f.includes('experienceV3Fixtures/runtime')) assert.ok(!/experienceV3Fixtures\/runtime/.test(src), `${f}: production code does not import the dev runtime fixtures`);
  }
}
passed('Private separation: no canary or reveal key in manifest/post/plan/slots; the reveal is one separate exact record; private files unreachable from public modules');

/* ===================================================== 5. full walk ===== */

{
  const h = correctionHost('rich');
  const m = h.m;
  const facts = () => sorted(h.s.receivedFacts);
  const persistCount = () => h.effects.filter(e => e.type === 'persist_decision').length;

  // load → enter desk
  ok(h, { type: 'LOADED' });
  ok(h, { type: 'ENTERED' });
  assert.deepEqual([h.s.scene, h.s.location, h.s.phase], ['c_desk', 'desk', 'playing']);
  assert.deepEqual(h.s.receivedFacts, [], 'nothing is known before the reader advances');
  // required context, then the title through its observation (optional route to a required fact)
  advance(h);
  assert.deepEqual(h.s.receivedFacts, ['f01', 'f02', 'f04', 'f05', 'f13', 'f14']);
  expectRejected(h.send({ type: 'REQUEST_PORTAL', id: 'cut_to_meeting', activationId: h.aid() }), 'unavailable', 'the desk exit waits for the title checkpoint');
  observe(h, 'obs_title');
  assert.ok(snap(h).receivedFacts.includes('f03'));
  const before = h.s.receivedFacts.length;
  advance(h, 'ev_title');
  assert.equal(h.s.receivedFacts.length, before, 'the checkpoint after the observation adds no duplicate receipt');
  // travel to the meeting: only the hero moves
  const desk = owners(h.s);
  travel(h, 'cut_to_meeting');
  assert.deepEqual([h.s.scene, h.s.location, h.s.arcIndex], ['c_meeting_before', 'meeting', 1]);
  assert.deepEqual(owners(h.s), { ...desk, a_me: 'location:meeting' }, 'desk → meeting transfers only the hero; summary stays carried; deck stays at the desk');
  // meeting facts, then the break
  advance(h, 'ev_arrive_meeting');
  advance(h, 'ev_board');
  assert.ok(snap(h).receivedFacts.includes('f06'));
  advance(h, 'ev_recognize');
  expectRejected(h.send({ type: 'REQUEST_PORTAL', id: 'start_break', activationId: h.aid() }), 'unavailable', 'no break before it opens');
  advance(h, 'ev_break');
  assert.deepEqual([h.s.variables.portal_p_hall, h.s.variables.portal_p_room], ['open', 'open']);
  expectRejected(h.send({ type: 'REQUEST_PORTAL', id: 'p_hall', activationId: h.aid() }), 'ahead_of_arc', 'the reversible door cannot jump ahead of the arc');
  // hallway: own summary, supported preparation of knowledge
  travel(h, 'start_break');
  assert.deepEqual([h.s.scene, h.s.location, h.s.arcIndex], ['c_hallway', 'hallway', 2]);
  advance(h, 'ev_hall_context');
  observe(h, 'obs_summary');
  assert.ok(snap(h).receivedFacts.includes('f10'));
  // return to the room during the break, then back out
  travel(h, 'p_room');
  assert.deepEqual([h.s.scene, h.s.location, h.s.arcIndex], ['c_meeting_before', 'meeting', 2], 'a room visit is c_meeting_before under the break, not a fifth scene');
  expectRejected(h.send({ type: 'ADVANCE', activationId: h.aid() }), 'nothing_to_advance', 'the room visit replays no historical beat');
  travel(h, 'p_hall');
  // resume the meeting
  travel(h, 'resume_meeting');
  assert.deepEqual([h.s.scene, h.s.arcIndex], ['c_meeting_question', 3]);
  expectRejected(h.send({ type: 'REQUEST_INTENT', id: 'correct_public', activationId: h.aid() }), 'knowledge_missing', 'no act before the question is asked');
  advance(h, 'ev_resume');
  assert.deepEqual([h.s.variables.portal_p_hall, h.s.variables.portal_p_room], ['closed', 'closed'], 'resume closes the break once');
  advance(h, 'ev_question');
  assert.deepEqual(facts(), sorted([...REQUIRED, ...OPTIONAL]), 'every required receipt (plus the inspected optional one)');
  const r0 = buildReadableModel(m, h.s);
  assert.deepEqual(r0.actions.filter(a => a.available).map(a => a.id), ['correct_public', 'request_private', 'pass_question'], 'the decision plateau offers all three acts');
  assert.deepEqual(r0.decision.missingKnowledge, []);
  // request → cancel → no decision written
  ok(h, { type: 'REQUEST_INTENT', id: 'correct_public', activationId: h.aid() });
  assert.equal(h.s.phase, 'confirming');
  ok(h, { type: 'CANCEL' });
  assert.deepEqual([h.s.phase, h.s.decision, h.s.reservation, persistCount()], ['playing', undefined, undefined, 0], 'cancel writes no choice');
  assert.deepEqual(facts(), sorted([...REQUIRED, ...OPTIONAL]), 'cancel keeps every learned fact');
  // request again → confirm → exactly one decision
  ok(h, { type: 'REQUEST_INTENT', id: 'correct_public', activationId: h.aid() });
  ok(h, { type: 'CONFIRM', id: 'correct_public', activationId: h.aid() });
  assert.deepEqual(h.s.decision, { id: 'd_the_correction_1', option: 'correct_public', status: 'recorded' });
  assert.equal(persistCount(), 1);
  assert.deepEqual(h.decisions, [{ decisionVersion: 'gold-1', attemptId: 'attempt_1', decision: 'd_the_correction_1', option: 'correct_public' }]);
  assert.ok(h.s.boundaryLocked);
  const atAccept = clone(h.s.entities);
  // enact → hold → truth boundary → reveal loading → loaded → ended
  assert.equal(h.s.phase, 'enacting');
  ok(h, { type: 'ENACTED' });
  assert.equal(h.s.phase, 'holding');
  ok(h, { type: 'HOLD_DONE' });
  assert.equal(h.s.phase, 'boundary');
  assert.equal(h.reveal, undefined, 'nothing released before the boundary is done');
  const b = ok(h, { type: 'BOUNDARY_DONE' });
  assert.deepEqual(b.effects.filter(e => e.type === 'load_reveal'), [{ type: 'load_reveal', experienceId: 'the-correction', revision: 'gold-1' }]);
  assert.equal(h.rows.at(-2)!.phase, 'reveal_loading', 'reveal loading is its own phase');
  assert.equal(h.s.phase, 'revealed');
  assert.deepEqual(h.reveal, correctionReveal());
  ok(h, { type: 'END' });
  assert.equal(h.s.phase, 'ended');
  assert.deepEqual(h.s.entities, atAccept, 'nothing moved after acceptance: no NPC response, no transfer');
  assert.equal(persistCount(), 1);
  // the whole run kept the reveal out of every snapshot it saved
  noLeaks(h.snapshots, 'saved snapshots');
  noLeaks(h.rows, 'trace rows');
}
passed('Full rich walk: desk → meeting → break → hallway ⇄ room → resume → act (cancel, then confirm once) → enact → hold → boundary → reveal → end');

{
  // Alternative paths: each other act, different positions, skip, no optional inspection.
  for (const [option, position, skip] of [['request_private', 'near', false], ['pass_question', 'seat', true]] as const) {
    const h = correctionHost('rich');
    walkToDecision(h, 'rich', { position, roomVisits: 0 });
    assert.ok(!h.s.receivedFacts.includes('f10'), 'optional summary never inspected');
    assert.equal(h.s.entities.find(e => e.id === 'a_me')!.state.mark_role, position === 'near' ? 'near_director' : 'own_seat');
    commit(h, option);
    finish(h, skip);
    assert.deepEqual(h.decisions.map(d => d.option), [option]);
    assert.deepEqual(h.reveal, correctionReveal(), `${option}: the same author account, whatever the act`);
    assert.equal(h.s.entities.find(e => e.id === 'a_director')!.owner.id, 'meeting');
    noLeaks(h.rows, `${option} trace`);
  }
}
passed('Alternative paths: request_private from near the director, pass_question from the seat with skip — same boundary, same account');

/* ============================================ 6. A → B → A persistence === */

{
  const h = correctionHost('rich');
  ok(h, { type: 'LOADED' });
  ok(h, { type: 'ENTERED' });
  advance(h);
  advance(h);
  travel(h, 'cut_to_meeting');
  for (let i = 0; i < 4; i++) advance(h);
  travel(h, 'start_break');
  // Leave the hallway before its delivery: pending evidence is suspended, not lost or replayed.
  travel(h, 'p_room');
  expectRejected(h.send({ type: 'ADVANCE', activationId: h.aid() }), 'nothing_to_advance', 'no meeting beat replays during a visit');
  travel(h, 'p_hall');
  assert.ok(buildReadableModel(h.m, h.s).canAdvance, 'the suspended hallway delivery is still waiting');
  advance(h, 'ev_hall_context');
  observe(h, 'obs_summary');
  const reference = clone(h.s);
  const availability = (s: RuntimeSnapshot) => {
    const r = buildReadableModel(h.m, s);
    return JSON.stringify({ p: r.portals, o: r.observations.map(o => [o.id, o.available]), a: r.actions, adv: r.canAdvance });
  };
  const hallAvailability = availability(h.s);

  for (let trip = 1; trip <= 5; trip++) {
    travel(h, 'p_room');
    // In the room: the same actors, same marks, no clones, no replay.
    assert.deepEqual(h.s.entities.filter(e => e.id !== 'a_me'), reference.entities.filter(e => e.id !== 'a_me'), 'actors and objects never move or reset on a visit');
    assert.equal(new Set(h.s.entities.map(e => e.id)).size, h.s.entities.length, 'no duplicate entity');
    assert.equal(h.s.entities.length, h.m.initialEntities.length);
    assert.deepEqual(h.s.entities.find(e => e.id === 'o_summary')!.owner, { kind: 'actor', id: 'a_me' }, 'the summary stays carried');
    expectRejected(h.send({ type: 'REQUEST_PORTAL', id: 'start_break', activationId: h.aid() }), 'not_next', 'returning does not rewind the arc');
    travel(h, 'p_hall');
    expectRejected(h.send({ type: 'ADVANCE', activationId: h.aid() }), 'nothing_to_advance');
    // Re-inspecting the summary is a free reread: no new receipt.
    const n0 = h.s.receivedFacts.length;
    observe(h, 'obs_summary');
    assert.equal(h.s.receivedFacts.length, n0);
    assert.deepEqual(h.s.receivedFacts, reference.receivedFacts, `trip ${trip}: received facts stay received, none added`);
    assert.deepEqual(h.s.seenObservations, reference.seenObservations, 'observations do not replay as new');
    assert.deepEqual(h.s.consumedEvents, reference.consumedEvents, 'quote/evidence events stay one-shot');
    assert.deepEqual(h.s.deliveredBeats, reference.deliveredBeats);
    assert.deepEqual(h.s.variables, reference.variables, 'the open break persists');
    assert.equal(h.s.arcIndex, 2, 'excursions never move the arc');
    assert.equal(availability(h.s), hallAvailability, 'leaving and re-entering does not change availability');
  }
  assert.equal(h.s.consumedEvents.filter(x => x === 'ev_board:0').length, 1, 'the board quote happened once');
  assert.ok(!h.m.portals.some(p => p.toScene === 'c_desk'), 'the desk is earlier time, never a live door');
  travel(h, 'resume_meeting');
  advance(h);
  advance(h);
  assert.deepEqual(buildReadableModel(h.m, h.s).portals, [], 'after resume no prior-break door remains');
  assert.deepEqual(h.s.receivedFacts.slice(0, reference.receivedFacts.length), reference.receivedFacts, 'the transcript survives the resume');
}
passed('A → B → A: five break round trips keep facts, observations, one-shot events, actors, ownership, arc and availability; resume never rewinds');

/* ======================================= 7. hallway value / removability === */

interface Outcome {
  facts: string[];
  beats: string[];
  options: unknown;
  decision: unknown;
  boundary: string;
  reveal: unknown;
}
function outcome(variant: CorrectionVariant, option: (typeof CORRECTION_OPTIONS)[number]): Outcome {
  const h = correctionHost(variant);
  walkToDecision(h, variant, { observeTitle: true, observeSummary: true, roomVisits: variant === 'rich' ? 1 : 0 });
  const at = { facts: sorted(h.s.receivedFacts), beats: sorted(h.s.deliveredBeats) };
  const options = h.m.opportunities.map(o => ({ ...o }));
  commit(h, option);
  finish(h);
  const d = h.m.primaryDecision!;
  return {
    ...at,
    options,
    decision: { id: d.id, minimumKnowledge: d.minimumKnowledge, options: d.options, accepted: h.decisions.map(x => x.option) },
    boundary: `${h.m.truthBoundary.after}@decision-scene:${h.m.truthBoundary.scene === d.scene}`,
    reveal: h.reveal,
  };
}
for (const option of CORRECTION_OPTIONS) {
  const rich = outcome('rich', option);
  const cmp = outcome('compressed', option);
  assert.deepEqual(cmp, rich, `${option}: rich and compressed preserve the same facts, beats, acts, decision, boundary and account`);
}
{
  // The structural difference is exactly the walkable break: no doors, the break narrated with the same facts.
  const cmp = correctionManifest('compressed');
  assert.deepEqual(correctionSemanticPlan('compressed').trace.narratedVariables, ['ev_break:break', 'ev_resume:break']);
  assert.deepEqual(correctionSemanticPlan('compressed').trace.mergedTransitions, ['start_break', 'resume_meeting']);
  assert.ok(!cmp.portals.some(p => p.kind === 'excursion'));
  assert.equal(cmp.initialEntities.find(e => e.id === 'o_deck')!.owner.kind, 'offstage', 'the desk display is a recollection, not invented in the meeting');
  assert.ok(cmp.observations.some(o => o.id === 'obs_title') && cmp.observations.some(o => o.id === 'obs_summary'), 'both observations preserved');
}
passed('Rich vs compressed: for all three acts the same facts, beats, options, decision, truth boundary and author account; only the walkable break differs');

/* ============================================= 8. readable path parity === */

function readableRun(variant: CorrectionVariant, option: string): { h: HeadlessHost; models: ReadableModel[] } {
  const h = correctionHost(variant);
  const models: ReadableModel[] = [];
  ok(h, { type: 'LOADED' });
  ok(h, { type: 'ENTERED' });
  // Only the readable model decides; only readableEvents act. No target, no pointer, no observation.
  for (let guard = 0; guard < 50; guard++) {
    const r = buildReadableModel(h.m, h.s);
    models.push(r);
    if (r.actions.length && r.actions.every(a => a.available)) break;
    if (r.canAdvance) expectOk(h.send(readableEvents.advance(h.aid())), 'readable advance');
    else {
      const spine = r.portals.filter(p => p.available && p.kind === 'spine');
      assert.equal(spine.length, 1, `exactly one way onward in ${r.scene.id}`);
      expectOk(h.send(readableEvents.travel(spine[0].id, h.aid())), 'readable continue');
    }
  }
  const r = buildReadableModel(h.m, h.s);
  assert.deepEqual(r.decision.missingKnowledge, [], 'all minimum knowledge without one observation or step of movement');
  expectOk(h.send(readableEvents.chooseAct(option, h.aid())), 'readable choose');
  expectOk(h.send(readableEvents.cancel()), 'readable cancel');
  expectOk(h.send(readableEvents.chooseAct(option, h.aid())), 'readable choose');
  expectOk(h.send(readableEvents.confirmAct(option, h.aid())), 'readable confirm');
  models.push(buildReadableModel(h.m, h.s));
  finish(h);
  models.push(buildReadableModel(h.m, h.s));
  return { h, models };
}
for (const v of CORRECTION_VARIANTS) {
  const m = correctionManifest(v);
  // Static: every required/minimum fact is delivered by a reader beat somewhere — never only by a spatial click.
  const byBeats = new Set(m.scenePlans.flatMap(s => s.beats.flatMap(b => b.events.flatMap(e => ('facts' in e ? e.facts : 'fact' in e ? [e.fact] : [])))));
  for (const f of [...REQUIRED, ...MINIMUM]) assert.ok(byBeats.has(f), `${v}: ${f} is deliverable without an observation`);
  for (const s of m.scenePlans) for (const f of s.requiredFacts) assert.ok(m.compiledScenes.find(c => c.id === s.id)!.accessibleText.some(a => a.fact === f), `${v}: ${f} readable text`);

  for (const option of CORRECTION_OPTIONS) {
    const { h, models } = readableRun(v, option);
    const spatial = canonicalRun(v, option);
    assert.deepEqual(sorted(h.s.receivedFacts), sorted(REQUIRED), 'readable receipts are exactly the required facts');
    assert.ok(REQUIRED.every(f => spatial.s.receivedFacts.includes(f)));
    assert.deepEqual(h.decisions.map(d => [d.decision, d.option]), spatial.decisions.map(d => [d.decision, d.option]), 'the same decision');
    assert.deepEqual(h.reveal, spatial.reveal, 'the same account');
    const revealPath = (x: HeadlessHost) => x.rows.filter(r => ['BOUNDARY_DONE', 'REVEAL_LOADED', 'END'].includes(r.event)).map(r => `${r.event}>${r.phase}`);
    assert.deepEqual(revealPath(h), revealPath(spatial), 'the same reveal sequence');
    const choice = models.find(x => x.actions.length)!;
    assert.deepEqual(choice.actions.map(a => [a.id, a.label, a.verb]), h.m.opportunities.map(o => [o.id, o.label, o.verb]), 'every primary act is listed');
    for (const x of models) noLeaks(x, `${v} readable model`);
    assert.equal(h.rows.filter(r => r.event.startsWith('OPEN_OBSERVATION') || r.event.startsWith('SELECT_TARGET')).length, 0);
  }
}
passed('Readable parity: with no movement, target or observation, both variants reach every required fact, all three acts, the same decision and reveal sequence; no early leak');

/* ======================================= 9. story-level input contract === */

{
  const h = correctionHost('rich');
  walkToDecision(h, 'rich');
  const m = h.m;
  // Enter in the world opens the action list; it never commits.
  const enter = routeKeydown(key('Enter'), worldCtx(h.s, m));
  assert.deepEqual(enter.action, { kind: 'activate' });
  ok(h, { type: 'ACTIVATE_CONTEXT', activationId: 'k1' });
  assert.deepEqual([h.s.phase, h.s.sheet?.kind, h.s.decision], ['playing', 'actions', undefined], 'Enter opened the list');
  // The same physical activation cannot also select (and so cannot open and confirm).
  expectRejected(h.send({ type: 'REQUEST_INTENT', id: 'correct_public', activationId: 'k1' }), 'duplicate_activation', 'one activation, one change');
  ok(h, { type: 'REQUEST_INTENT', id: 'correct_public', activationId: 'k2' });
  assert.equal(h.s.phase, 'confirming');
  // While the confirmation is open, a world Enter is not the world's (native button activation only); a held key does nothing.
  assert.deepEqual(routeKeydown(key('Enter'), worldCtx(h.s, m)).action, { kind: 'none' });
  assert.deepEqual(routeKeydown(key('Enter', { repeat: true }), worldCtx(h.s, m)).action, { kind: 'none' });
  expectRejected(h.send({ type: 'CONFIRM', id: 'correct_public', activationId: 'k2' }), 'duplicate_activation', 'the selecting activation cannot confirm');
  expectRejected(h.send({ type: 'CONFIRM', id: 'pass_question', activationId: 'k3' }), 'stale_confirmation', 'a confirmation for another act is stale');
  // Escape closes the confirmation: back to play, nothing written.
  assert.deepEqual(routeKeydown(key('Escape'), worldCtx(h.s, m)).action, { kind: 'cancel', scope: 'intent_sheet' });
  ok(h, { type: 'CANCEL' });
  assert.deepEqual([h.s.phase, h.s.decision], ['playing', undefined]);
  expectRejected(h.send({ type: 'CONFIRM', id: 'correct_public', activationId: 'k4' }), 'stale_confirmation', 'a confirmation after cancel is stale');
  // A target that offers one act still opens a sheet; the director target lists only the request.
  ok(h, { type: 'SELECT_TARGET', target: { kind: 'actor', id: 'a_director' } });
  ok(h, { type: 'ACTIVATE_CONTEXT', activationId: 'k5' });
  assert.equal(h.s.sheet?.kind, 'target');
  ok(h, { type: 'CANCEL' });
  ok(h, { type: 'REQUEST_INTENT', id: 'request_private', activationId: 'k6' });
  ok(h, { type: 'CONFIRM', id: 'request_private', activationId: 'k7' });
  // Accepted: no undo, no second act, no world change.
  assert.deepEqual(routeKeydown(key('Escape'), worldCtx(h.s, m)).action, { kind: 'none' }, 'no Escape undo during enactment');
  const locked = h.s;
  for (const [e, code] of [
    [{ type: 'CANCEL' }, 'locked'],
    [{ type: 'REQUEST_INTENT', id: 'correct_public', activationId: 'k8' }, 'decision_closed'],
    [{ type: 'CONFIRM', id: 'request_private', activationId: 'k9' }, 'duplicate_decision'],
    [{ type: 'REQUEST_PORTAL', id: 'p_hall', activationId: 'k10' }, 'locked'],
    [{ type: 'OPEN_OBSERVATION', id: 'obs_summary', activationId: 'k11' }, 'locked'],
    [{ type: 'APPLY_PREPARATION', id: 'prep_near', activationId: 'k12' }, 'locked'],
    [{ type: 'REVERT_PREPARATION', id: 'prep_near', activationId: 'k13' }, 'locked'],
    [{ type: 'ADVANCE', activationId: 'k14' }, 'locked'],
    [{ type: 'SELECT_TARGET', target: { kind: 'self' } }, 'locked'],
  ] as const) {
    const r = h.send(e as never);
    expectRejected(r, code, `after acceptance ${e.type}`);
    assert.equal(r.state, locked, `${e.type} leaves the state object untouched`);
  }
  ok(h, { type: 'ENACTED' });
  ok(h, { type: 'HOLD_DONE' });
  for (const t of ['REQUEST_PORTAL', 'OPEN_OBSERVATION', 'APPLY_PREPARATION'] as const) expectRejected(h.send({ type: t, id: 'p_hall', activationId: h.aid() } as never), 'locked', `${t} after the boundary`);
  assert.equal(h.decisions.length, 1);
}
passed('Story input: Enter opens, never commits; one activation cannot open and confirm; cancel returns to play; stale confirmation refused; the accepted act cannot be undone; the world is locked after it');

/* ======================================== 10. placeholder geometry ====== */

{
  for (const v of CORRECTION_VARIANTS) {
    const m = correctionManifest(v);
    for (const c of m.compiledScenes) {
      assert.equal(c.kitRevision, PLACEHOLDER_GEOMETRY_ID);
      assert.ok([c.cameraRecipe, c.lightRecipe, c.audioRecipe].every(x => x.startsWith('dev_placeholder_')), 'placeholders are obviously named');
      assert.ok(c.entryMark && c.marks, `${c.id} loads with an entry mark`);
    }
    // Every reposition target exists in the decision scene; every door resolves to a compiled scene.
    const decisionMarks = m.compiledScenes.find(c => c.id === m.primaryDecision!.scene)!.marks!;
    for (const p of m.preparations) if (p.action.kind === 'reposition') assert.ok(p.action.markRole in decisionMarks, `${p.id} → ${p.action.markRole}`);
    for (const p of m.portals) assert.ok(m.compiledScenes.some(c => c.id === p.toScene));
    // Design's slots ask only for marks the geometry provides.
    const geo = correctionGeometry(v);
    for (const slot of correctionSceneSlots(v)) for (const mk of slot.requiredMarks) assert.ok(mk in (geo.scenes[slot.scene].marks ?? {}), `${slot.scene} needs ${mk}`);
  }
  // Replacing the geometry with a Design export changes no story state and no identity.
  const design: GeometryExport = {
    ...correctionGeometry('rich'),
    id: 'design-office-r1',
    assetRevisions: { office_kit: 'design-office-r1' },
    assetHashes: { office_kit: 'abcdef0123456789abcdef0123456789' },
  };
  for (const s of Object.values(design.scenes)) Object.assign(s, { kitRevision: 'design-office-r1', compositionRevision: 'design-office-r1', cameraRecipe: 'cam_office', lightRecipe: 'light_office', audioRecipe: 'bed_office' });
  const swapped = correctionManifest('rich', design);
  assert.ok(validateManifest(swapped, { profile: 'launch' }).ok);
  const semantic = (m: PlaybackManifestV3) => ({ ...m, compiledScenes: m.compiledScenes.map(c => c.accessibleText), assetRevisions: null, assetHashes: null });
  assert.deepEqual(semantic(swapped), semantic(correctionManifest('rich')), 'geometry swap leaves every semantic field, revision and decision version unchanged');
  // No controller or projection code knows the placeholder.
  for (const d of ['src/engine/v3', 'src/engine/input', 'src/components/experience/v3']) {
    const files: string[] = [];
    const walk = (x: string) => readdirSync(x).forEach(f => (statSync(join(x, f)).isDirectory() ? walk(join(x, f)) : files.push(join(x, f))));
    walk(d);
    for (const f of files) assert.ok(!/dev_placeholder|dev-placeholder/.test(readFileSync(f, 'utf8')), `${f} hardcodes no placeholder art`);
  }
}
passed('Placeholder geometry: dev-named, every scene/door/mark resolves; a Design geometry export swaps in with no semantic, revision or decision change');

/* ========================================== 11. visual handshake ======= */

{
  const h = correctionHost('rich', { holdPreloads: true });
  const hooksLog: ReturnType<typeof projectVisualHooks>[] = [];
  const snap = () => hooksLog.push(projectVisualHooks(h.m, h.s, SETTINGS));
  const go = (portal: string) => {
    ok(h, { type: 'REQUEST_PORTAL', id: portal, activationId: h.aid() });
    snap();
    assert.equal(hooksLog.at(-1)!.transition.state, 'preloading', 'Design sees the preload, before any swap');
    assert.equal(hooksLog.at(-1)!.scene.id, h.rows.at(-1)!.scene, 'the source scene stays mounted until the swap');
    expectOk(h.completePreload(h.pendingPreloads[0]), 'swap');
    snap();
  };
  ok(h, { type: 'LOADED' });
  ok(h, { type: 'ENTERED' });
  snap();
  advance(h);
  advance(h);
  go('cut_to_meeting');
  for (let i = 0; i < 4; i++) advance(h);
  go('start_break');
  advance(h);
  const hall = projectVisualHooks(h.m, h.s, SETTINGS);
  const mira = hall.actors.find(a => a.id === 'a_mira')!;
  assert.deepEqual([mira.inView, mira.location, mira.visibleThrough], [false, 'meeting', 'p_room'], 'Mira is seen through the open door, never transferred');
  assert.deepEqual(hall.objects.find(o => o.id === 'o_summary')!, { id: 'o_summary', kind: 'object', isHero: false, owner: { kind: 'actor', id: 'a_me' }, location: 'hallway', inView: true, heldBy: 'a_me' });
  assert.deepEqual(hall.doors.find(d => d.id === 'p_room'), { id: 'p_room', kind: 'excursion', label: 'Return to the room', available: true, state: 'open' });
  ok(h, { type: 'OPEN_OBSERVATION', id: 'obs_summary', activationId: h.aid() });
  assert.deepEqual(projectVisualHooks(h.m, h.s, SETTINGS).attention.observation, { id: 'obs_summary', target: { kind: 'object', id: 'o_summary' }, facts: ['f10'], presentation: 'insert' });
  ok(h, { type: 'CLOSE_OBSERVATION' });
  go('resume_meeting');
  advance(h);
  advance(h);
  ok(h, { type: 'REQUEST_INTENT', id: 'pass_question', activationId: h.aid() });
  snap();
  assert.deepEqual(hooksLog.at(-1)!.opportunity, { selected: 'pass_question', pendingConfirmation: true });
  assert.equal(hooksLog.at(-1)!.commitment, undefined, 'a selection is not a commitment');
  ok(h, { type: 'CONFIRM', id: 'pass_question', activationId: h.aid() });
  snap();
  assert.deepEqual(hooksLog.at(-1)!.commitment, { decisionId: 'd_the_correction_1', option: 'pass_question', status: 'recorded', enactment: 'enacting' });
  ok(h, { type: 'SKIP' });
  snap();
  assert.deepEqual(hooksLog.at(-1)!.boundary, { locked: true, reached: true });
  ok(h, { type: 'BOUNDARY_DONE' });
  snap();
  assert.equal(hooksLog.at(-1)!.reveal.phase, 'ready');
  for (const x of hooksLog) {
    noLeaks(x, 'visual hooks');
    assert.equal(new Set(x.actors.map(a => a.id)).size, 3, 'three foreground actors, never cloned');
    assert.ok(!allKeys(x).has('authorOption'));
  }
  // Settings are presentation only: they change nothing else.
  const still = projectVisualHooks(h.m, h.s, { ...SETTINGS, reducedMotion: true, audio: 'unavailable' });
  assert.deepEqual({ ...still, settings: null }, { ...projectVisualHooks(h.m, h.s, SETTINGS), settings: null });
  // A hidden tab makes presentation ineligible without touching story state.
  const hidden = step(h.m, h.s, { type: 'PAUSE', reason: 'hidden' });
  assert.equal(projectVisualHooks(h.m, hidden.state, SETTINGS).presentationEligible, false);
  // Design slot table: every hook it names exists on VisualHooksV3, every act has gold confirmation copy.
  const sample = hooksLog[0] as unknown as Record<string, unknown>;
  for (const hk of SCENE_HOOKS) assert.ok(hk.split('.')[0] in sample || hk === 'commitment', `hook ${hk}`);
  const acts = correctionActSlots();
  assert.deepEqual(acts.map(a => a.option), ['correct_public', 'request_private', 'pass_question']);
  assert.deepEqual(acts.map(a => a.caption.status), ['pending_editorial', 'pending_editorial', 'gold']);
  assert.deepEqual(acts[2].caption, { status: 'gold', text: 'You let this question pass without speaking.' });
  assert.deepEqual(correctionAmbientCues(), ['ev_office_bed']);
}
passed('Visual handshake: phase/scene/transition/actors/objects/doors/attention/selection/commitment/boundary/reveal hooks project correctly, leak nothing, and settings never change state');

/* ================================================ 12. dev trace ========== */

{
  const runs = Array.from({ length: 5 }, () => correctionTrace('rich', 'correct_public', { roomVisits: 2, observeSummary: true, observeTitle: true, position: 'near', cancelFirst: true }));
  for (const r of runs) assert.deepEqual(r, runs[0], 'the trace is deterministic');
  const rows = runs[0];
  noLeaks(rows, 'dev trace');
  const last = rows.at(-1)!;
  assert.deepEqual([last.phase, last.decision, last.locked], ['ended', 'correct_public:recorded', true]);
  assert.ok(last.reveal.includes('text withheld from trace'));
  for (const col of ['scene', 'location', 'newFacts', 'entities', 'seenObservations', 'available', 'decision', 'phase', 'locked'] as const) assert.ok(col in last, `trace column ${col}`);
  for (const v of CORRECTION_VARIANTS) for (const o of CORRECTION_OPTIONS) noLeaks(correctionTrace(v, o), `${v}/${o} trace`);
}
passed('Dev trace: deterministic across runs, shows scene/location/facts/entities/observations/availability/decision/phase/boundary, never reveal text');

/* ================================================== 13. red team ========= */

{
  // Portal requested twice; stale and late completions; failure restores the source exactly.
  const h = correctionHost('rich', { holdPreloads: true });
  walkToDecision(new HeadlessHost(h.m, { resolveReveal: resolveCorrectionReveal, binding: correctionRevealBinding() }), 'rich'); // sanity: the plain host still works
  ok(h, { type: 'LOADED' });
  ok(h, { type: 'ENTERED' });
  advance(h);
  advance(h);
  const src = clone(h.s);
  const r1 = ok(h, { type: 'REQUEST_PORTAL', id: 'cut_to_meeting', activationId: h.aid() });
  expectRejected(h.send({ type: 'REQUEST_PORTAL', id: 'cut_to_meeting', activationId: h.aid() }), 'busy', 'a second request never opens a second transaction');
  assert.equal(h.effects.filter(e => e.type === 'preload_scene').length, 1);
  expectRejected(h.completePreload('tx99'), 'stale_transaction', 'a completion for an unknown transaction');
  const tx1 = r1.effects.find(e => e.type === 'preload_scene')!;
  ok(h, { type: 'TRANSITION_FAILED', txId: (tx1 as { txId: string }).txId });
  assert.deepEqual([h.s.scene, h.s.location, owners(h.s), h.s.receivedFacts], [src.scene, src.location, owners(src), src.receivedFacts], 'failure before the swap leaves the source intact');
  expectRejected(h.completePreload((tx1 as { txId: string }).txId), 'stale_transaction', 'a late completion of the failed transaction');
  ok(h, { type: 'REQUEST_PORTAL', id: 'cut_to_meeting', activationId: h.aid() });
  assert.equal(h.pendingPreloads.at(-1), 'tx2');
  expectOk(h.completePreload('tx2'), 'retry commits');
  expectRejected(h.completePreload('tx2'), 'stale_transaction', 'a duplicate completion');
  assert.equal(h.s.scene, 'c_meeting_before');
}
{
  // Returning repeatedly: 25 round trips, nothing grows except the transaction counter.
  const h = correctionHost('rich');
  walkToDecision(h, 'rich', { observeSummary: true, roomVisits: 0 });
  const g = correctionHost('rich');
  ok(g, { type: 'LOADED' });
  ok(g, { type: 'ENTERED' });
  advance(g);
  advance(g);
  travel(g, 'cut_to_meeting');
  for (let i = 0; i < 4; i++) advance(g);
  travel(g, 'start_break');
  advance(g);
  const ref = clone(g.s);
  for (let i = 0; i < 25; i++) {
    travel(g, 'p_room');
    travel(g, 'p_hall');
  }
  assert.deepEqual({ ...g.s, txCounter: 0, consumedActivations: [], visitedScenes: [] }, { ...ref, txCounter: 0, consumedActivations: [], visitedScenes: [] });
  assert.equal(g.s.txCounter, ref.txCounter + 50);
  assert.deepEqual(g.s.visitedScenes, ref.visitedScenes, 'visited scenes are a set');
}
{
  // Duplicate observation, confirm twice, cancel then confirm, skip before decision, skip after acceptance.
  const h = correctionHost('rich');
  walkToDecision(h, 'rich');
  ok(h, { type: 'OPEN_OBSERVATION', id: 'obs_summary', activationId: h.aid() });
  expectRejected(h.send({ type: 'OPEN_OBSERVATION', id: 'obs_summary', activationId: h.aid() }), 'busy', 'an open observation cannot open twice');
  ok(h, { type: 'CLOSE_OBSERVATION' });
  observe(h, 'obs_summary');
  assert.equal(h.s.seenObservations.filter(x => x === 'obs_summary').length, 1);
  assert.equal(h.s.receivedFacts.filter(x => x === 'f10').length, 1);
  expectRejected(h.send({ type: 'SKIP' }), 'skip_before_commit', 'skip cannot create an act');
  ok(h, { type: 'REQUEST_INTENT', id: 'correct_public', activationId: h.aid() });
  ok(h, { type: 'CANCEL' });
  expectRejected(h.send({ type: 'CONFIRM', id: 'correct_public', activationId: h.aid() }), 'stale_confirmation', 'cancel then confirm');
  assert.equal(h.s.decision, undefined);
  ok(h, { type: 'REQUEST_INTENT', id: 'correct_public', activationId: h.aid() });
  ok(h, { type: 'CONFIRM', id: 'correct_public', activationId: h.aid() });
  expectRejected(h.send({ type: 'CONFIRM', id: 'correct_public', activationId: h.aid() }), 'duplicate_decision', 'confirm twice');
  ok(h, { type: 'SKIP' });
  assert.equal(h.s.phase, 'boundary', 'skip after acceptance reaches the same boundary');
  expectRejected(h.send({ type: 'SKIP' }), 'wrong_phase', 'skip twice');
  assert.deepEqual([h.decisions.length, snap(h).decision?.option], [1, 'correct_public']);
}
{
  // Reveal load failure: the act stays accepted; retries never ask for a second choice.
  const h = correctionHost('rich', { failRevealLoads: 2 });
  walkToDecision(h, 'rich');
  commit(h, 'pass_question');
  ok(h, { type: 'ENACTED' });
  ok(h, { type: 'HOLD_DONE' });
  ok(h, { type: 'BOUNDARY_DONE' });
  assert.deepEqual([h.s.phase, h.s.reveal, h.s.decision?.option], ['reveal_loading', 'failed', 'pass_question']);
  ok(h, { type: 'RETRY_REVEAL' });
  assert.equal(h.s.reveal, 'failed');
  expectRejected(h.send({ type: 'REQUEST_INTENT', id: 'correct_public', activationId: h.aid() }), 'decision_closed', 'no replacement choice on failure');
  ok(h, { type: 'RETRY_REVEAL' });
  assert.deepEqual([h.s.phase, h.decisions.length], ['revealed', 1]);
  assert.deepEqual(h.reveal, correctionReveal());
  // An unresolvable record fails safely too.
  const u = new HeadlessHost(correctionManifest('rich'), { resolveReveal: () => undefined, binding: correctionRevealBinding() });
  walkToDecision(u, 'rich');
  commit(u, 'correct_public');
  finishToBoundary(u);
  assert.deepEqual([u.s.phase, u.s.reveal, u.reveal], ['reveal_loading', 'failed', undefined]);
}
function finishToBoundary(h: HeadlessHost) {
  ok(h, { type: 'ENACTED' });
  ok(h, { type: 'HOLD_DONE' });
  ok(h, { type: 'BOUNDARY_DONE' });
}
{
  // Resume mid-transition: the source comes back, the old transaction is stale, travel works again.
  const h = correctionHost('rich', { holdPreloads: true });
  ok(h, { type: 'LOADED' });
  ok(h, { type: 'ENTERED' });
  advance(h);
  advance(h);
  ok(h, { type: 'REQUEST_PORTAL', id: 'cut_to_meeting', activationId: h.aid() });
  const stored = JSON.stringify(h.s); // what a pagehide save would hold
  const r = correctionHost('rich', { restoreFrom: stored, holdPreloads: true });
  // A restored story re-enters through loading: the host prepares the restored scene exactly as on first entry.
  assert.deepEqual([r.s.phase, r.s.scene, r.s.transition, r.s.time.pauses], ['loading', 'c_desk', undefined, []]);
  ok(r, { type: 'LOADED' });
  ok(r, { type: 'ENTERED' });
  // Foundation fix: a reloaded InputManager restarts at the same ids; the first gesture after resume must count.
  assert.ok(JSON.parse(stored).consumedActivations.includes('h1'));
  assert.deepEqual(r.s.consumedActivations, [], 'activation ids from the previous page session are not carried over');
  expectRejected(r.completePreload('tx1'), 'stale_transaction', 'the pre-resume transaction cannot land');
  ok(r, { type: 'REQUEST_PORTAL', id: 'cut_to_meeting', activationId: r.aid() });
  expectOk(r.completePreload(r.pendingPreloads[0]), 'fresh transaction');
  assert.equal(r.s.scene, 'c_meeting_before');
}
{
  // Resume after acceptance: straight to the boundary, the act unchanged, no second write, same account.
  const h = correctionHost('rich');
  walkToDecision(h, 'rich');
  commit(h, 'request_private');
  const saved = h.snapshots.at(-1)!;
  assert.equal(JSON.parse(saved).decision.option, 'request_private');
  const r = correctionHost('rich', { restoreFrom: saved });
  assert.deepEqual([r.s.phase, r.s.decision?.option, r.s.boundaryLocked], ['boundary', 'request_private', true]);
  expectRejected(r.send({ type: 'REQUEST_INTENT', id: 'correct_public', activationId: r.aid() }), 'decision_closed');
  expectRejected(r.send({ type: 'CONFIRM', id: 'request_private', activationId: r.aid() }), 'duplicate_decision');
  ok(r, { type: 'BOUNDARY_DONE' });
  // The reducer asks for no second write. Resending the unrecorded operation under its identical key is the host's job (test-v3-host.ts).
  assert.deepEqual([r.s.phase, r.effects.filter(e => e.type === 'persist_decision').length], ['revealed', 0]);
  assert.equal(JSON.parse(saved).decision.status, 'recorded', 'the stored claim');
  assert.equal(restoreSnapshot(h.m, JSON.parse(saved))!.decision?.status, 'accepted', 'a stored "recorded" is a claim, not an acknowledgement: it restores as accepted');
  assert.deepEqual(r.reveal, correctionReveal());
  // A snapshot from the other variant, a future snapshot version or another decision version never restores.
  assert.equal(restoreSnapshot(correctionManifest('compressed'), JSON.parse(saved)), undefined);
  assert.equal(restoreSnapshot(h.m, { ...JSON.parse(saved), snapshotVersion: 1 }), undefined);
  assert.equal(restoreSnapshot(h.m, { ...JSON.parse(saved), decisionVersion: 'gold-2' }), undefined);
}
{
  // Malformed and tampered snapshots (Foundation fix): refused instead of crashing the reducer later.
  const h = correctionHost('rich');
  walkToDecision(h, 'rich');
  const good = JSON.parse(JSON.stringify(h.s)) as RuntimeSnapshot;
  assert.ok(restoreSnapshot(h.m, good));
  const ent = (id: string, owner: object) => good.entities.map(e => (e.id === id ? { ...e, owner } : e));
  const bad: Record<string, unknown> = {
    preparationsNotList: { ...good, preparations: 'x' },
    variablesNull: { ...good, variables: null },
    clockMissing: { ...good, time: undefined },
    unknownBeat: { ...good, deliveredBeats: [...good.deliveredBeats, 'ev_invented'] },
    unknownObservation: { ...good, seenObservations: ['obs_invented'] },
    duplicatedActor: { ...good, entities: [...good.entities.slice(0, 2), good.entities[1], ...good.entities.slice(3)] },
    actorCarriedByActor: { ...good, entities: ent('a_mira', { kind: 'actor', id: 'a_me' }) },
    actorInUnknownPlace: { ...good, entities: ent('a_director', { kind: 'location', id: 'boardroom' }) },
    heroElsewhere: { ...good, entities: ent('a_me', { kind: 'location', id: 'desk' }) },
    foreignDecision: { ...good, decision: { id: 'd_other', option: 'correct_public', status: 'accepted' } },
  };
  for (const [name, raw] of Object.entries(bad)) assert.equal(restoreSnapshot(h.m, raw), undefined, `tampered snapshot refused: ${name}`);
}
{
  // Overlapping repositions (Foundation fix): the hero stands in one place; undo can never strand a mark.
  const h = correctionHost('rich');
  walkToDecision(h, 'rich');
  const hero = () => h.s.entities.find(e => e.id === 'a_me')!.state.mark_role;
  ok(h, { type: 'APPLY_PREPARATION', id: 'prep_near', activationId: h.aid() });
  ok(h, { type: 'APPLY_PREPARATION', id: 'prep_seat', activationId: h.aid() });
  assert.deepEqual([hero(), h.s.preparations.map(p => p.id)], ['own_seat', ['prep_seat']], 'the new position supersedes the old');
  expectRejected(h.send({ type: 'REVERT_PREPARATION', id: 'prep_near', activationId: h.aid() }), 'not_applied', 'the superseded position cannot be undone underneath');
  ok(h, { type: 'REVERT_PREPARATION', id: 'prep_seat', activationId: h.aid() });
  assert.deepEqual([hero(), h.s.preparations], [undefined, []], 'undo returns to the arrival baseline');
  const r = buildReadableModel(h.m, h.s);
  assert.deepEqual(r.actions.filter(a => a.available).map(a => a.id), ['correct_public', 'request_private', 'pass_question'], 'position never changes the offered acts');
}
{
  // Idle never accepts silence; long reading, blur and hidden tabs consume nothing.
  const h = correctionHost('rich');
  walkToDecision(h, 'rich');
  ok(h, { type: 'PAUSE', reason: 'hidden' });
  for (let i = 0; i < 600; i++) h.send({ type: 'TICK', dtMs: 1000 });
  ok(h, { type: 'RESUME', reason: 'hidden' });
  for (let i = 0; i < 600; i++) h.send({ type: 'TICK', dtMs: 1000 });
  assert.deepEqual([h.s.phase, h.s.decision, h.s.time.opportunityMs], ['playing', undefined, 0], 'twenty minutes of idling choose nothing');
  assert.equal(buildReadableModel(h.m, h.s).actions.filter(a => a.available).length, 3);
}
{
  // Malformed fixtures and future versions never play.
  const post = correctionPost('rich');
  const mutate = (f: (m: Record<string, any>) => void): StoredPostV3 => {
    const p = clone(post) as unknown as { playback: Record<string, any> };
    f(p.playback);
    return p as unknown as StoredPostV3;
  };
  const cases: Record<string, StoredPostV3> = {
    revealKey: mutate(m => (m.authorOption = 'correct_public')),
    actKeyOnOpportunity: mutate(m => (m.opportunities[0].act = privateReveal.act)),
    urlInFact: mutate(m => (m.facts[0].text += ' https://example.test')),
    missingRequiredFact: mutate(m => (m.facts = m.facts.filter((f: { id: string }) => f.id !== 'f12'))),
    duplicatedActor: mutate(m => m.initialEntities.push(clone(m.initialEntities[1]))),
    excursionWithoutReturn: mutate(m => delete m.portals[3].returnPortal),
    portalToNowhere: mutate(m => (m.portals[0].toScene = 'c_boardroom')),
    heroNotAtFirstScene: mutate(m => (m.initialEntities[0].owner.id = 'hallway')),
    optionOutsideDecisionScene: mutate(m => (m.scenePlans[3].opportunityIds = ['correct_public'])),
    asymmetricReturn: mutate(m => (m.portals[4].toScene = 'c_meeting_question')),
  };
  for (const [name, p] of Object.entries(cases)) {
    const r = loadPlayable(p);
    assert.equal(r.kind, 'invalid_v3', `${name} is refused`);
  }
  assert.ok(has((loadPlayable(cases.revealKey) as { issues: ValidationIssue[] }).issues, 'unknown_key'));
  assert.deepEqual(loadPlayable(mutate(m => (m.runtimeManifestVersion = 4))), { kind: 'unsupported', reason: 'future_manifest_version' });
  assert.deepEqual(loadPlayable(mutate(m => (m.semanticSchemaVersion = 4))), { kind: 'unsupported', reason: 'future_manifest_version' });
  assert.deepEqual(loadPlayable({ ...clone(post), postSchemaVersion: 4 }), { kind: 'unsupported', reason: 'future_post_schema' });
  assert.deepEqual(loadPlayable(clone(post).playback), { kind: 'unsupported', reason: 'unrecognised_shape' }, 'a bare manifest is not a post');
}
{
  // A fact that is required but no longer delivered: the decision stays closed rather than guessing.
  const m = correctionManifest('rich');
  const q = m.scenePlans[3].beats.find(b => b.id === 'ev_question')!;
  q.events = q.events.filter(e => !(e.kind === 'deliver' && e.facts.includes('f12')));
  assert.ok(validateManifest(m).ok, 'structurally valid, so the controller is the guard');
  const h = new HeadlessHost(m, { resolveReveal: resolveCorrectionReveal, binding: correctionRevealBinding() });
  walkToDecision(h, 'rich');
  assert.ok(!h.s.receivedFacts.includes('f12'));
  expectRejected(h.send({ type: 'REQUEST_INTENT', id: 'correct_public', activationId: h.aid() }), 'knowledge_missing', 'no act without the minimum');
  assert.deepEqual(buildReadableModel(h.m, h.s).decision.missingKnowledge, ['f12'], 'the gap is visible, by id');
}
{
  // Reveal canaries injected into public material are caught, including quote and newline variants (Foundation fix).
  const dirty = correctionManifest('rich');
  dirty.observations[0].label = privateReveal.act;
  assert.ok(findPrivateLeaks(dirty, CORRECTION_REVEAL_CANARIES).length > 0);
  const straight = privateReveal.act.replace(/[“”]/g, '"');
  assert.deepEqual(findPrivateLeaks({ note: straight }, [straight]), [0], 'a canary with straight quotes is still found in JSON');
  assert.deepEqual(findPrivateLeaks({ note: `${privateReveal.why}\n${privateReveal.aftermath}` }, [`${privateReveal.why}\n${privateReveal.aftermath}`]), [0], 'and across a newline');
  assert.deepEqual(findPrivateLeaks(foundationManifest(), CORRECTION_REVEAL_CANARIES), []);
}
{
  // Adapter red team: anything it cannot map faithfully is an error, never a guess.
  const env = clone(CORRECTION_ENVELOPE);
  const a = correctionAdaptation('rich');
  const throws = (what: string, e: GoldEnvelope, x = a) => assert.throws(() => adaptGoldSpec(e, x), AdaptationError, what);
  throws('a gold door neither kept nor removed', env, { ...a, excursions: { p_room: a.excursions.p_room } });
  throws('an unmapped planning variable', env, { ...a, stateVariables: {} });
  throws('a preparation scoped only by scene', env, { ...a, gateOverrides: {} });
  throws('a fact with no source span', env, { ...a, factSpans: { ...a.factSpans, F10: [] } });
  throws('a reordered spine', env, { ...a, scenes: [a.scenes[1], a.scenes[0], a.scenes[2], a.scenes[3]] });
  const ambient = clone(env);
  ambient.scenes[0].beats.push('ev_office_bed');
  throws('ambient presentation as a beat', ambient);
  const minimum = clone(env);
  minimum.opportunities[1].minimumKnowledge = minimum.opportunities[1].minimumKnowledge.slice(1);
  throws('a per-option minimum Foundation would silently lose', minimum);
  throws('an unknown envelope', { ...env, specEnvelopeVersion: 'vivi-format-proof-2' });
  // A compile against geometry missing a scene fails loudly.
  const geo = correctionGeometry('rich');
  delete geo.scenes.c_hallway;
  assert.throws(() => compileFixturePlan(correctionSemanticPlan('rich').plan, { experienceId: 'the-correction', revision: 'gold-1', decisionVersion: 'gold-1', locale: 'en', compilerVersion: '0.1.0-dev.1', stagingDisclosure: 'x', geometry: geo }));
}
{
  // Generic code: the adapter, compiler, host and visual hooks branch on no story.
  for (const f of ['src/data/experienceV3Fixtures/runtime/adaptGoldSpec.ts', 'src/data/experienceV3Fixtures/runtime/compileFixturePlan.ts', 'scripts/lib/v3HeadlessHost.ts', 'src/components/experience/v3/visualHooks.ts']) {
    const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.ok(!/correction|mira|director|c_desk|c_hallway|c_meeting|p_hall|p_room|o_summary|a_me\b|f\d\d\b|ev_[a-z]/i.test(src), `${f} names no story element`);
  }
}
passed('Red team: double portal, stale/late/failed transitions, 25 returns, duplicate observation, confirm twice, cancel→confirm, skip before/after, reveal failure, resume mid-transition/after acceptance, tampered snapshots, overlapping positions, idling, malformed/future fixtures, missing fact, leak variants, adapter misuse');

/* ============================================== 14. determinism ========= */

{
  const fingerprint = () =>
    JSON.stringify(
      CORRECTION_VARIANTS.flatMap(v =>
        CORRECTION_OPTIONS.map(o => {
          const h = canonicalRun(v, o, { observeSummary: true, observeTitle: true, roomVisits: v === 'rich' ? 3 : 0, position: 'near', cancelFirst: true });
          return [h.rows, h.s, h.snapshots, h.decisions];
        })
      )
    );
  const first = fingerprint();
  for (let i = 0; i < 3; i++) assert.equal(fingerprint(), first, 'identical rows, final snapshots, saves and decisions');
}
passed('Deterministic: every variant × act, run repeatedly, yields byte-identical traces, snapshots, saves and decision writes');

console.log(`\nAll ${n} Correction headless integration checks passed.`);
console.log('Technical evidence only. Not evidence of atmosphere, engagement, hallway value, visual quality, reveal impact or understanding.');
