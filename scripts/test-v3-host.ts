import assert from 'node:assert/strict';
import { ExperienceHost, decisionKey, type HostOptions } from '../src/components/experience/v3/ExperienceHost.ts';
import type { AcceptanceJournal, DecisionAck, DecisionOperation, DecisionRepository, HostConfig, JournalEntry, PreparedScene, PreloadSceneRequest, RevealLoadRequest } from '../src/components/experience/v3/hostContracts.ts';
import type { PlaybackManifestV3 } from '../src/engine/v3/contracts/manifest.ts';
import type { ExperienceEvent } from '../src/engine/v3/ExperienceController.ts';
import { FOUNDATION_REVEAL_CANARIES, foundationManifest, foundationReveal } from '../src/engine/v3/testing/foundationFixture.ts';
import { CORRECTION_REVEAL_CANARIES, correctionReveal, correctionRevealBinding } from '../src/data/experienceV3Fixtures/runtime/theCorrection.reveal.ts';
import { correctionManifest } from '../src/data/experienceV3Fixtures/runtime/theCorrection.ts';

/**
 * V3 host contract tests (B03 async preparation and presentation, B04 durable acceptance, B06 private record).
 *
 * Everything asynchronous is a deferred promise the test resolves by hand, so ordering, staleness and failure
 * are exercised exactly, with no timers. The reducer is the real one; only the host's injected functions are fakes.
 */

console.log('Testing V3 host contracts (async, deferred promises)...\n');
let n = 0;
const ok = (label: string) => console.log(`✓ ${++n}. ${label}`);

/* ------------------------------------------------------------ helpers --- */

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => ((resolve = a), (reject = b)));
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise<void>(r => setImmediate(r));
};

let act = 0;
const aid = () => `a${++act}`;

interface Rig {
  host: ExperienceHost;
  config: Extract<HostConfig, { mode: 'visual' }>;
  preloads: Array<{ req: PreloadSceneRequest; d: Deferred<PreparedScene> }>;
  journalWrites: Array<{ entry: JournalEntry; d: Deferred<void> }>;
  records: Array<{ op: DecisionOperation; d: Deferred<DecisionAck> }>;
  reveals: Array<{ req: RevealLoadRequest; d: Deferred<unknown> }>;
  store: Map<string, JournalEntry>;
  m: PlaybackManifestV3;
}

interface RigOptions {
  m?: PlaybackManifestV3;
  host?: HostOptions;
  /** Resolve every preload at once (a loader that is instantly ready). */
  autoPreload?: boolean;
  autoJournal?: boolean;
  autoRepository?: boolean;
  autoReveal?: boolean;
  store?: Map<string, JournalEntry>;
  binding?: Extract<HostConfig, { mode: 'visual' }>['reveal'];
  revealRecord?: () => unknown;
}

function rig(o: RigOptions = {}): Rig {
  const m = o.m ?? foundationManifest();
  const r: Rig = { preloads: [], journalWrites: [], records: [], reveals: [], store: o.store ?? new Map(), m } as unknown as Rig;
  const journal: AcceptanceJournal = {
    write: e => {
      const d = deferred<void>();
      r.journalWrites.push({ entry: e, d });
      if (o.autoJournal) {
        r.store.set('j', e);
        d.resolve();
      }
      return d.promise.then(() => void r.store.set('j', e));
    },
    read: () => r.store.get('j'),
  };
  const repository: DecisionRepository = {
    record: op => {
      const d = deferred<DecisionAck>();
      r.records.push({ op, d });
      if (o.autoRepository) d.resolve({ key: op.key, decisionId: op.decisionId, option: op.option });
      return d.promise;
    },
  };
  r.config = {
    mode: 'visual',
    preloadScene: req => {
      const d = deferred<PreparedScene>();
      r.preloads.push({ req, d });
      if (o.autoPreload) d.resolve({ sceneId: req.sceneId });
      return d.promise;
    },
    journal,
    repository,
    loadReveal: req => {
      const d = deferred<unknown>();
      r.reveals.push({ req, d });
      if (o.autoReveal) d.resolve(o.revealRecord ? o.revealRecord() : foundationReveal());
      return d.promise;
    },
    reveal: o.binding ?? { revealRef: 'reveal-foundation', recordRevision: 'r1' },
  };
  r.host = new ExperienceHost(m, r.config, { attemptId: 'a1', ...o.host });
  return r;
}

const last = <T,>(xs: T[]) => xs[xs.length - 1];
const phase = (r: Rig) => r.host.getState().phase;
const send = (r: Rig, e: ExperienceEvent) => r.host.dispatch(e);
const sendOk = (r: Rig, e: ExperienceEvent, what: string = e.type) => {
  const res = send(r, e);
  assert.equal(res.rejected, undefined, `${what}: rejected as ${res.rejected?.code}`);
  return res;
};

/** Mount and complete the entry preparation. */
async function enter(r: Rig) {
  r.host.attach();
  await flush();
  last(r.preloads).d.resolve({ sceneId: r.host.getState().scene });
  await flush();
  assert.equal(phase(r), 'entering');
  sendOk(r, { type: 'ENTERED' });
}
async function travel(r: Rig, portal: string) {
  sendOk(r, { type: 'REQUEST_PORTAL', id: portal, activationId: aid() }, `request ${portal}`);
  assert.equal(phase(r), 'transitioning');
  await flush();
  const p = last(r.preloads);
  p.d.resolve({ sceneId: p.req.sceneId });
  await flush();
  sendOk(r, { type: 'ENTERED' }, 'entered');
}
async function toDecision(r: Rig) {
  await enter(r);
  sendOk(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  sendOk(r, { type: 'CLOSE_OBSERVATION' });
  await travel(r, 'p_a_to_b');
  sendOk(r, { type: 'ADVANCE' });
  sendOk(r, { type: 'ADVANCE' });
  await travel(r, 'p_b_to_c');
  sendOk(r, { type: 'ADVANCE' });
}
async function commit(r: Rig, option = 'act_speak') {
  sendOk(r, { type: 'REQUEST_INTENT', id: option, activationId: aid() });
  sendOk(r, { type: 'CONFIRM', id: option, activationId: aid() });
  await flush();
}
/** Present the act and the boundary, as a renderer would. */
function present(r: Rig) {
  assert.deepEqual(r.host.enacted(r.host.receiptToken()), { ok: true });
  assert.deepEqual(r.host.held(r.host.receiptToken()), { ok: true });
  assert.deepEqual(r.host.boundaryPresented(r.host.receiptToken()), { ok: true });
}
const ackOf = (op: DecisionOperation): DecisionAck => ({ key: op.key, decisionId: op.decisionId, option: op.option });

/* ====================================================================== */
/* B03 — asynchronous preparation                                          */
/* ====================================================================== */

await (async () => {
  // A visual host without a loader prepares nothing: it can never succeed by default.
  const bare = new ExperienceHost(foundationManifest(), { mode: 'visual' } as unknown as HostConfig, { attemptId: 'a1' });
  assert.deepEqual(bare.getStatus().config.missing.sort(), ['journal', 'loadReveal', 'preloadScene', 'repository', 'reveal']);
  bare.attach();
  await flush();
  assert.equal(bare.getState().phase, 'loading', 'no loader: the entry scene is never "prepared"');
  assert.equal(bare.getStatus().entry, 'failed');
  // The explicit headless host is the only one that completes preparation on its own.
  const head = new ExperienceHost(foundationManifest(), { mode: 'headless' }, { attemptId: 'a1' });
  head.attach();
  await flush();
  assert.equal(head.getState().phase, 'entering', 'headless without a loader is ready at once');
})();
ok('A visual host with no loader never prepares a scene (config failure); only the explicit headless mode completes at once');

await (async () => {
  const r = rig();
  r.host.attach();
  await flush();
  assert.equal(phase(r), 'loading', 'waiting for the preparation promise');
  assert.equal(r.host.getStatus().entry, 'preparing');
  assert.equal(r.preloads.length, 1);
  assert.deepEqual([r.preloads[0].req.sceneId, r.preloads[0].req.txId, r.preloads[0].req.identity.attemptId, r.preloads[0].req.identity.manifestRevision], ['scene_a', 'entry', 'a1', 'r1']);
  assert.equal(r.preloads[0].req.signal.aborted, false);
  // Resolving for the WRONG scene is a failure, not a success.
  r.preloads[0].d.resolve({ sceneId: 'scene_b' });
  await flush();
  assert.equal(phase(r), 'loading');
  assert.equal(r.host.getStatus().entry, 'failed');
  // Retry: a rejection fails visibly, a later success proceeds.
  r.host.retryEntry();
  await flush();
  r.preloads[1].d.reject(new Error('network'));
  await flush();
  assert.equal(r.host.getStatus().entry, 'failed');
  r.host.retryEntry();
  await flush();
  r.preloads[2].d.resolve({ sceneId: 'scene_a', fallback: 'still' });
  await flush();
  assert.equal(phase(r), 'entering');
  assert.equal(r.host.getStatus().entry, 'ready');
  // A synchronous throw in the loader is the same as a rejection.
  const t = new ExperienceHost(foundationManifest(), { ...rig().config, preloadScene: () => { throw new Error('sync'); } }, { attemptId: 'a1' });
  t.attach();
  await flush();
  assert.deepEqual([t.getState().phase, t.getStatus().entry], ['loading', 'failed']);
})();
ok('Entry preparation is awaited: wrong scene, rejection and a synchronous throw fail visibly; retry works; a still fallback counts as prepared');

await (async () => {
  const r = rig();
  await enter(r);
  sendOk(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  sendOk(r, { type: 'CLOSE_OBSERVATION' });
  sendOk(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() });
  await flush();
  const first = last(r.preloads);
  assert.equal(first.req.sceneId, 'scene_b');
  assert.equal(phase(r), 'transitioning', 'the swap waits for the destination to be prepared');
  assert.equal(r.host.getState().scene, 'scene_a', 'the old scene is still current');
  // Failure: back to the source, nothing lost, a clear status; the user can try again.
  first.d.reject(new Error('decode'));
  await flush();
  assert.equal(phase(r), 'playing');
  assert.equal(r.host.getState().scene, 'scene_a');
  assert.deepEqual([r.host.getStatus().transition.state, r.host.getStatus().transition.error], ['failed', 'load_failed']);
  // A late resolve of the failed attempt must not complete anything.
  first.d.resolve({ sceneId: 'scene_b' });
  await flush();
  assert.equal(r.host.getState().scene, 'scene_a', 'a late completion of a failed transaction is ignored');
  // A superseded transaction: tx A is still in flight when it is aborted and a new request (tx B) begins.
  // Same mount, same attempt, same phase: only the transaction id tells A's late completion from B's.
  sendOk(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() });
  await flush();
  const txA = last(r.preloads);
  sendOk(r, { type: 'TRANSITION_FAILED', txId: txA.req.txId }, 'the shell aborts transaction A');
  assert.equal(phase(r), 'playing');
  sendOk(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() });
  await flush();
  const txB = last(r.preloads);
  assert.notEqual(txB.req.txId, txA.req.txId, 'a new transaction has a new id within one mount');
  txA.d.resolve({ sceneId: 'scene_b' });
  await flush();
  assert.equal(phase(r), 'transitioning', "transaction A's late completion cannot complete transaction B");
  assert.equal(r.host.getState().scene, 'scene_a');
  assert.deepEqual(r.host.getStatus().transition, { state: 'preparing', txId: txB.req.txId }, "and the status still says B is preparing (A's completion did not touch it)");
  // Second attempt (B): an invalid prepared scene is a failure too.
  txB.d.resolve({ sceneId: 'scene_c' });
  await flush();
  assert.equal(r.host.getStatus().transition.error, 'invalid_prepared');
  assert.equal(phase(r), 'playing');
  // Third attempt succeeds.
  await travel(r, 'p_a_to_b');
  assert.equal(r.host.getState().scene, 'scene_b');
  // A visual host without a loader fails the transition (unconfigured) instead of swapping.
  const nl = new ExperienceHost(foundationManifest(), { ...rig().config, preloadScene: undefined } as unknown as HostConfig, { attemptId: 'a1' });
  assert.deepEqual(nl.getStatus().config.missing, ['preloadScene']);
})();
ok('Portal preparation is awaited; failure returns to the source with a visible status; late/invalid completions never swap the scene');

await (async () => {
  // Stale generations: the transaction id recurs across mounts; only the live mount's completion may land.
  const r = rig();
  await enter(r);
  sendOk(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  sendOk(r, { type: 'CLOSE_OBSERVATION' });
  sendOk(r, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() });
  await flush();
  const old = last(r.preloads);
  const oldSignal = old.req.signal;
  r.host.detach(); // unmount
  assert.equal(oldSignal.aborted, true, 'unmount aborts in-flight preparation');
  r.host.attach(); // remount: the interrupted preparation resumes under a new generation with the SAME transaction id
  await flush();
  const fresh = last(r.preloads);
  assert.notEqual(fresh, old);
  assert.equal(fresh.req.txId, old.req.txId, 'the transaction id recurs across mounts');
  assert.ok(fresh.req.identity.mount > old.req.identity.mount);
  old.d.resolve({ sceneId: 'scene_b' }); // the OLD generation completes now, while the host is attached again: still stale
  await flush();
  assert.equal(phase(r), 'transitioning', 'a completion from an earlier mount cannot complete the new mount\'s transaction');
  assert.equal(r.host.getState().scene, 'scene_a');
  // And a completion that arrives while detached changes nothing either.
  const w = rig();
  await enter(w);
  sendOk(w, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  sendOk(w, { type: 'CLOSE_OBSERVATION' });
  sendOk(w, { type: 'REQUEST_PORTAL', id: 'p_a_to_b', activationId: aid() });
  await flush();
  const wp = last(w.preloads);
  w.host.detach();
  wp.d.resolve({ sceneId: 'scene_b' });
  await flush();
  assert.deepEqual([phase(w), w.host.getState().scene], ['transitioning', 'scene_a'], 'a completion after unmount changes nothing');
  fresh.d.resolve({ sceneId: 'scene_b' });
  await flush();
  assert.equal(phase(r), 'entering');
  assert.equal(r.host.getState().scene, 'scene_b');

  // A different attempt: a host built with another attempt id never accepts the first one's completion.
  const a = rig({ host: { attemptId: 'x1' } });
  const b = rig({ host: { attemptId: 'x2' } });
  a.host.attach();
  b.host.attach();
  await flush();
  a.preloads[0].d.resolve({ sceneId: 'scene_a' });
  await flush();
  assert.deepEqual([a.host.getState().phase, b.host.getState().phase], ['entering', 'loading'], 'hosts and attempts are independent');
  assert.equal(b.preloads[0].req.identity.attemptId, 'x2');

  // A revision change is a new host: the old one is detached and its late callbacks land nowhere.
  const c1 = rig();
  c1.host.attach();
  await flush();
  c1.host.detach();
  const m2 = foundationManifest();
  (m2 as { revision: string }).revision = 'r2';
  const c2 = rig({ m: m2 });
  c2.host.attach();
  await flush();
  c1.preloads[0].d.resolve({ sceneId: 'scene_a' });
  await flush();
  assert.deepEqual([c1.host.getState().phase, c2.host.getState().phase, c2.preloads[0].req.identity.manifestRevision], ['loading', 'loading', 'r2']);
})();
ok('Stale guards: unmount aborts and ignores completions; recurring tx ids across mounts, attempts and revisions never complete the wrong work');

/* ====================================================================== */
/* B03 — presentation phases are separate receipts                          */
/* ====================================================================== */

await (async () => {
  const r = rig({ autoJournal: true, autoRepository: true, autoReveal: true });
  await toDecision(r);
  await commit(r);
  assert.equal(phase(r), 'enacting', 'a visual host does not enact, hold or finish by itself');
  await flush();
  assert.equal(phase(r), 'enacting');
  const t0 = r.host.receiptToken()!;
  assert.deepEqual([t0.phase, t0.option, t0.attemptId], ['enacting', 'act_speak', 'a1']);
  // Wrong phase, wrong choice, stale mount and an absent token are all refused and change nothing.
  assert.deepEqual(r.host.held(t0), { ok: false, reason: 'wrong_phase' });
  assert.deepEqual(r.host.enacted({ ...t0, option: 'act_wait' }), { ok: false, reason: 'stale' });
  assert.deepEqual(r.host.enacted({ ...t0, decisionId: 'ghost' }), { ok: false, reason: 'stale' });
  assert.deepEqual(r.host.enacted({ ...t0, attemptId: 'other' }), { ok: false, reason: 'stale' });
  assert.deepEqual(r.host.enacted({ ...t0, mount: t0.mount + 1 }), { ok: false, reason: 'stale' });
  assert.deepEqual(r.host.enacted(undefined), { ok: false, reason: 'stale' });
  assert.deepEqual(r.host.boundaryPresented(t0), { ok: false, reason: 'wrong_phase' });
  assert.equal(phase(r), 'enacting');
  // A hidden page renders nothing, so it cannot complete a phase.
  sendOk(r, { type: 'PAUSE', reason: 'hidden' });
  assert.deepEqual(r.host.enacted(r.host.receiptToken()), { ok: false, reason: 'hidden' });
  sendOk(r, { type: 'RESUME', reason: 'hidden' });
  assert.deepEqual(r.host.enacted(r.host.receiptToken()), { ok: true });
  assert.equal(phase(r), 'holding', 'enacted is its own receipt');
  assert.deepEqual(r.host.enacted(t0), { ok: false, reason: 'wrong_phase' }, 'a receipt cannot be replayed');
  assert.deepEqual(r.host.held(r.host.receiptToken()), { ok: true });
  assert.equal(phase(r), 'boundary', 'held is its own receipt');
  assert.equal(r.host.getStatus().revealGate, 'waiting_for_presentation', 'the boundary has not been presented');
  await flush();
  assert.equal(phase(r), 'boundary', 'nothing advances the boundary on its own');
  assert.deepEqual(r.host.boundaryPresented(r.host.receiptToken()), { ok: true });
  assert.notEqual(phase(r), 'boundary', 'presented + durable: the account opens');
  await flush();
  assert.equal(phase(r), 'revealed');
  // Detached hosts accept no receipts.
  const d = rig();
  await toDecision(d);
  await commit(d);
  const tok = d.host.receiptToken();
  d.host.detach();
  assert.deepEqual(d.host.enacted(tok), { ok: false, reason: 'detached' });
})();
ok('Presentation is three separate receipts bound to mount, attempt, decision, option and phase; hidden, stale, replayed and detached receipts are refused');

await (async () => {
  // Deterministic skip: lands on the same boundary, never alters the act, and the bridge counts as presented.
  const r = rig({ autoJournal: true, autoRepository: true, autoReveal: true });
  await toDecision(r);
  await commit(r);
  assert.deepEqual(r.host.skip(), { ok: true });
  assert.equal(phase(r), 'boundary');
  assert.equal(r.host.getState().decision?.option, 'act_speak');
  assert.equal(r.host.getStatus().revealGate, 'waiting_for_presentation', 'skipping the act does not skip the boundary bridge');
  assert.deepEqual(r.host.skip(), { ok: true }, 'skip during the boundary counts the bridge as presented');
  await flush();
  assert.equal(phase(r), 'revealed');
  assert.deepEqual(r.host.skip(), { ok: false, reason: 'wrong_phase' });
  // From the hold, too.
  const h = rig({ autoJournal: true, autoRepository: true, autoReveal: true });
  await toDecision(h);
  await commit(h);
  assert.deepEqual(h.host.enacted(h.host.receiptToken()), { ok: true });
  assert.deepEqual(h.host.skip(), { ok: true });
  assert.equal(phase(h), 'boundary');
})();
ok('Skip is deterministic from the act, the hold and the boundary, and never changes the accepted choice');

/* ====================================================================== */
/* B04 — durable acceptance                                                 */
/* ====================================================================== */

await (async () => {
  const r = rig();
  await toDecision(r);
  await commit(r);
  const op = r.records[0].op;
  assert.equal(op.key, `v3:foundation_fixture:${r.m.decisionVersion}:a1:act_speak`, 'attempt + decision version + option');
  assert.equal(op.key, decisionKey(op));
  assert.equal(r.records.length, 1);
  assert.equal(r.journalWrites.length, 1);
  assert.deepEqual(r.journalWrites[0].entry.op, op, 'the journal and the repository see the identical operation');
  assert.equal(JSON.stringify(r.journalWrites[0].entry).includes('CANARY'), false, 'the journal holds no private record');
  // Pending: accepted, not recorded; status says saving.
  assert.equal(r.host.getState().decision?.status, 'accepted');
  assert.deepEqual([r.host.getStatus().persistence.journal, r.host.getStatus().persistence.repository, r.host.getStatus().persistence.durable], ['writing', 'saving', false]);
  // A second confirmation is a rejected duplicate and sends nothing.
  assert.equal(send(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() }).rejected?.code, 'duplicate_decision');
  assert.equal(r.records.length, 1, 'no second write');
  // The acknowledgement must name this exact operation.
  r.records[0].d.resolve({ key: op.key, decisionId: op.decisionId, option: 'act_wait' });
  await flush();
  assert.equal(r.host.getState().decision?.status, 'accepted', 'a wrong-option ack records nothing');
  assert.equal(r.host.getStatus().persistence.error, 'ack_mismatch');
  assert.equal(r.host.getStatus().persistence.repository, 'failed');
  assert.equal(r.host.getState().decision?.option, 'act_speak', 'and never changes the choice');
})();
ok('An acceptance sends one operation (key = attempt + decision version + option) to journal and repository; a wrong ack records nothing');

await (async () => {
  for (const bad of [
    (op: DecisionOperation): unknown => ({ ...ackOf(op), key: 'v3:other' }),
    (op: DecisionOperation): unknown => ({ ...ackOf(op), decisionId: 'd_other' }),
    (): unknown => undefined,
    (): unknown => null,
    (): unknown => 'ok',
    (): unknown => ({}),
  ]) {
    const r = rig();
    await toDecision(r);
    await commit(r);
    r.records[0].d.resolve(bad(r.records[0].op) as DecisionAck);
    await flush();
    assert.equal(r.host.getState().decision?.status, 'accepted');
    assert.equal(r.host.getStatus().persistence.error, 'ack_mismatch');
  }
  // A synchronous throw is a rejection; a synchronous valid ack is an ack.
  const sync = rig();
  sync.config.repository = { record: () => { throw new Error('boom'); } };
  const h1 = new ExperienceHost(sync.m, sync.config, { attemptId: 'a1' });
  const r1 = { ...sync, host: h1 } as Rig;
  await toDecision(r1);
  await commit(r1);
  assert.equal(h1.getStatus().persistence.error, 'repository_failed');
  assert.equal(h1.getState().decision?.status, 'accepted');
  const syncOk = rig({ autoPreload: true });
  syncOk.config.repository = { record: op => ackOf(op) };
  const h2 = new ExperienceHost(syncOk.m, syncOk.config, { attemptId: 'a1' });
  h2.attach();
  await flush();
  assert.equal(h2.getState().phase, 'entering');
})();
ok('Malformed, mismatched, empty and thrown repository results never record a decision; a synchronous throw equals a rejection');

await (async () => {
  const r = rig({ autoJournal: true });
  await toDecision(r);
  await commit(r);
  const first = r.records[0];
  first.d.reject(new Error('503'));
  await flush();
  const st = r.host.getStatus().persistence;
  assert.deepEqual([st.repository, st.error, st.durable, r.host.getState().decision?.status], ['failed', 'repository_failed', true, 'accepted'], 'failure is visible; the local journal still holds the choice');
  assert.equal(r.host.getState().boundaryLocked, true);
  // The shell's retry re-sends the IDENTICAL operation; it can never be a second choice.
  assert.equal(r.host.retryPersistence(), true);
  await flush();
  assert.equal(r.records.length, 2);
  assert.deepEqual(r.records[1].op, first.op, 'identical operation and key');
  assert.equal(r.journalWrites.length, 1, 'the journal is not rewritten');
  assert.equal(r.host.getStatus().persistence.attempts, 2);
  r.records[1].d.resolve(ackOf(r.records[1].op));
  await flush();
  assert.equal(r.host.getState().decision?.status, 'recorded');
  assert.equal(r.host.getStatus().persistence.repository, 'recorded');
  assert.equal(r.host.retryPersistence(), false, 'nothing left to retry');
  // The pending first request completing late cannot double-record.
  first.d.resolve(ackOf(first.op));
  await flush();
  assert.equal(r.host.getState().decision?.status, 'recorded');
})();
ok('A failed save is visible, keeps the accepted choice, and Retry re-sends the identical operation and key');

await (async () => {
  // The reveal gate: presented AND durably accepted (journal written or repository acknowledged).
  const r = rig({ autoReveal: true });
  await toDecision(r);
  await commit(r);
  present(r);
  assert.equal(phase(r), 'boundary');
  assert.equal(r.host.getStatus().revealGate, 'waiting_for_durable_acceptance');
  assert.equal(r.reveals.length, 0, 'the private record is not even requested before durable acceptance');
  // Both writes fail: still waiting, with a visible error.
  r.journalWrites[0].d.reject(new Error('quota'));
  r.records[0].d.reject(new Error('offline'));
  await flush();
  assert.equal(phase(r), 'boundary');
  assert.equal(r.host.getStatus().revealGate, 'waiting_for_durable_acceptance');
  assert.equal(r.host.getStatus().persistence.durable, false);
  // Retrying and getting the journal written releases it.
  assert.equal(r.host.retryPersistence(), true);
  await flush();
  r.journalWrites[1].d.resolve();
  await flush();
  assert.equal(r.host.getStatus().persistence.durable, true);
  assert.notEqual(phase(r), 'boundary');
  assert.equal(r.reveals.length, 1);
  // Without a journal or repository (headless), durable acceptance is not demanded unless configured.
  const head = new ExperienceHost(foundationManifest(), { mode: 'headless', loadReveal: () => Promise.resolve(foundationReveal()), reveal: { revealRef: 'x', recordRevision: 'r1' } }, { attemptId: 'a1' });
  head.attach();
  await flush();
  sendOk({ host: head } as Rig, { type: 'ENTERED' });
  const strict = new ExperienceHost(foundationManifest(), { mode: 'headless', requireDurableAcceptance: true, loadReveal: () => Promise.resolve(foundationReveal()), reveal: { revealRef: 'x', recordRevision: 'r1' } }, { attemptId: 'a1' });
  assert.equal(strict.getStatus().revealGate, 'closed');
})();
ok('The reveal waits for the presented boundary and for durable acceptance; both writes failing keeps the gate shut and visible');

await (async () => {
  // Missing persistence is an unconfigured failure, never a recorded decision.
  const head = new ExperienceHost(foundationManifest(), { mode: 'headless' }, { attemptId: 'a1' });
  const r = { host: head, m: foundationManifest(), preloads: [] } as unknown as Rig;
  head.attach();
  await flush();
  sendOk(r, { type: 'ENTERED' });
  sendOk(r, { type: 'OPEN_OBSERVATION', id: 'o_a1', activationId: aid() });
  sendOk(r, { type: 'CLOSE_OBSERVATION' });
  for (const p of ['p_a_to_b']) { sendOk(r, { type: 'REQUEST_PORTAL', id: p, activationId: aid() }); await flush(); sendOk(r, { type: 'ENTERED' }); }
  sendOk(r, { type: 'ADVANCE' });
  sendOk(r, { type: 'ADVANCE' });
  sendOk(r, { type: 'REQUEST_PORTAL', id: 'p_b_to_c', activationId: aid() });
  await flush();
  sendOk(r, { type: 'ENTERED' });
  sendOk(r, { type: 'ADVANCE' });
  sendOk(r, { type: 'REQUEST_INTENT', id: 'act_speak', activationId: aid() });
  sendOk(r, { type: 'CONFIRM', id: 'act_speak', activationId: aid() });
  await flush();
  const p = head.getStatus().persistence;
  assert.deepEqual([p.journal, p.repository, p.durable], ['unconfigured', 'unconfigured', false]);
  assert.equal(head.getState().decision?.status, 'accepted', 'no repository: never "recorded"');
  assert.equal(head.retryPersistence(), false, 'nothing to retry when nothing is configured');
})();
ok('No repository and no journal: acceptance stays accepted, the status says unconfigured, and nothing pretends it was saved');

await (async () => {
  // Recovery from the journal on reload: a recovered choice is not re-asked and re-sent with the identical key.
  const a = rig({ autoJournal: true });
  await toDecision(a);
  await commit(a);
  const op = a.records[0].op;
  const store = a.store; // survives the "reload"; the repository never answered
  assert.ok(store.get('j'));

  const b = rig({ store, autoPreload: true, autoRepository: false, host: { attemptId: 'fresh-attempt' } });
  b.host.attach();
  await flush();
  assert.equal(b.host.getStatus().recovery, 'recovered');
  assert.equal(b.host.getState().attemptId, 'a1', 'the recovered attempt owns the choice');
  assert.deepEqual([b.host.getState().decision?.option, b.host.getState().decision?.status, b.host.getState().boundaryLocked], ['act_speak', 'accepted', true]);
  assert.equal(b.host.getState().phase, 'boundary', 'a recovered accepted act resumes at the boundary, never a choice');
  assert.equal(b.records.length, 1);
  assert.deepEqual(b.records[0].op, op, 'the unrecorded choice is re-sent with the identical key');
  b.records[0].d.resolve(ackOf(op));
  await flush();
  assert.equal(b.host.getState().decision?.status, 'recorded');

  // Tampered/foreign journal entries are ignored; the host starts fresh and writes nothing from them.
  const mk = (mutate: (e: any) => void, rekey = false) => {
    const e = JSON.parse(JSON.stringify(store.get('j')));
    mutate(e);
    if (rekey) e.op.key = decisionKey(e.op); // a forger who also recomputes the key: only the identity checks can catch it
    return new Map<string, JournalEntry>([['j', e]]);
  };
  const cases: Array<[string, Map<string, JournalEntry>]> = [
    ['other decision version', mk(e => (e.op.decisionVersion = 'dv-other'))],
    ['other experience', mk(e => (e.op.experienceId = 'other'))],
    ['other revision', mk(e => (e.op.manifestRevision = 'r9'))],
    ['other decision version, key recomputed', mk(e => (e.op.decisionVersion = 'dv-other'), true)],
    ['other experience, key recomputed', mk(e => (e.op.experienceId = 'other'), true)],
    ['other revision, key recomputed', mk(e => (e.op.manifestRevision = 'r9'), true)],
    ['other attempt, key recomputed', mk(e => (e.op.attemptId = 'someone-else'), true)],
    ['other option, key recomputed', mk(e => (e.op.option = 'act_wait'), true)],
    ['other decision id, key recomputed', mk(e => (e.op.decisionId = 'd_other'), true)],
    ['option tampered in the operation', mk(e => (e.op.option = 'act_wait'))],
    ['option tampered in the snapshot', mk(e => (e.snapshot.decision.option = 'act_wait'))],
    ['key tampered', mk(e => (e.op.key = 'v3:forged'))],
    ['attempt tampered', mk(e => (e.op.attemptId = 'someone-else'))],
    ['snapshot without a decision', mk(e => delete e.snapshot.decision)],
    ['snapshot junk', mk(e => (e.snapshot = { junk: 1 }))],
    ['operation junk', mk(e => (e.op = 5))],
  ];
  for (const [label, bad] of cases) {
    const c = rig({ store: bad, autoPreload: true, host: { attemptId: 'fresh-attempt' } });
    c.host.attach();
    await flush();
    assert.equal(c.host.getStatus().recovery, 'ignored_invalid', label);
    assert.equal(c.host.getState().decision, undefined, `${label}: nothing adopted`);
    assert.equal(c.host.getState().attemptId, 'fresh-attempt', label);
    assert.equal(c.records.length, 0, `${label}: nothing sent`);
  }
  // A throwing or empty journal is simply no recovery.
  const t = new ExperienceHost(foundationManifest(), { ...rig({ autoPreload: true }).config, journal: { read: () => { throw new Error('x'); }, write: () => undefined } }, { attemptId: 'a1' });
  t.attach();
  await flush();
  assert.equal(t.getStatus().recovery, 'none');
})();
ok('Reload recovery adopts only an exact, valid journal entry (same experience, revision, decision version, attempt, option, key) and re-sends it idempotently');

await (async () => {
  // Explicit restore of an accepted-but-unrecorded snapshot also re-sends the identical operation.
  const a = rig({ autoJournal: true });
  await toDecision(a);
  await commit(a);
  const stored = JSON.parse(JSON.stringify(a.host.getState()));
  const b = rig({ autoPreload: true, host: { attemptId: 'ignored', restore: stored } });
  b.host.attach();
  await flush();
  assert.equal(b.host.getState().attemptId, 'a1');
  assert.deepEqual(b.records.map(x => x.op.key), [a.records[0].op.key]);
  // A stored "recorded" claim is not an acknowledgement.
  const claimed = JSON.parse(JSON.stringify(stored));
  claimed.decision.status = 'recorded';
  const c = rig({ autoPreload: true, host: { restore: claimed } });
  c.host.attach();
  await flush();
  assert.equal(c.host.getState().decision?.status, 'accepted');
  assert.equal(c.records.length, 1, 'the claim triggers a real acknowledgement request');
  // Garbage restores start fresh.
  const g = rig({ host: { restore: { nonsense: true }, attemptId: 'g1' } });
  assert.equal(g.host.getState().attemptId, 'g1');
  assert.equal(g.host.getState().phase, 'loading');
})();
ok('A restored snapshot re-resolves its acknowledgement: a stored "recorded" is a claim, and a garbage snapshot starts fresh');

/* ====================================================================== */
/* B06 — the private record                                                 */
/* ====================================================================== */

await (async () => {
  const r = rig({ autoJournal: true, autoRepository: true });
  await toDecision(r);
  await commit(r);
  present(r);
  await flush();
  assert.equal(phase(r), 'reveal_loading');
  assert.equal(r.reveals.length, 1);
  assert.deepEqual([r.reveals[0].req.experienceId, r.reveals[0].req.manifestRevision, r.reveals[0].req.revealRef, r.reveals[0].req.recordRevision], ['foundation_fixture', 'r1', 'reveal-foundation', 'r1']);
  assert.equal(r.host.revealRecord(), undefined, 'no record until it is loaded and validated');
  // The record is also invisible in the snapshot and the status while loading and after.
  const audit = () => JSON.stringify([r.host.getState(), r.host.getStatus(), r.host.identity()]);
  for (const c of FOUNDATION_REVEAL_CANARIES) assert.equal(audit().includes(c), false);
  const fromLoader = foundationReveal();
  r.reveals[0].d.resolve(fromLoader);
  await flush();
  assert.equal(phase(r), 'revealed');
  // The loader keeps its reference and changes it after validation: the host's record must not follow.
  (fromLoader as { act?: string }).act = '<script>swapped after validation</script>';
  assert.notEqual(r.host.revealRecord()!.act, fromLoader.act, 'a validated record is a private copy, not the loader\'s object');
  const rec = r.host.revealRecord()!;
  assert.equal(rec.experienceId, 'foundation_fixture');
  assert.ok(rec.act && rec.why);
  for (const c of FOUNDATION_REVEAL_CANARIES) assert.equal(audit().includes(c), false, 'the record never enters the snapshot or the host status');
  // It is a private copy: mutating what the shell received changes nothing.
  (rec as { act?: string }).act = 'tampered';
  assert.notEqual(r.host.revealRecord()!.act, 'tampered');
  assert.equal(r.host.getStatus().reveal.state, 'ready');
})();
ok('The reveal loads only after the boundary, is returned as a validated copy, and never enters the snapshot or the status');

await (async () => {
  const gates: Array<[string, () => unknown]> = [
    ['undefined', () => undefined],
    ['null', () => null],
    ['a string', () => 'the author said'],
    ['an array', () => []],
    ['another experience', () => ({ ...foundationReveal(), experienceId: 'someone_else' })],
    ['another record revision', () => ({ ...foundationReveal(), revision: 'r2' })],
    ['unknown schema version', () => ({ ...foundationReveal(), revealSchemaVersion: 2 })],
    ['unknown status', () => ({ ...foundationReveal(), status: 'rumour' })],
    ['an unknown key', () => ({ ...foundationReveal(), editorNote: 'x' })],
    ['markup in the account', () => ({ ...foundationReveal(), act: '<script>alert(1)</script> I did it' })],
    ['a URL in the account', () => ({ ...foundationReveal(), why: 'see https://example.com/leak' })],
    ['an author option that is not an option', () => ({ ...foundationReveal(), authorOption: 'act_invented' })],
    ['an empty account', () => { const { act: _a, why: _w, aftermath: _f, ...rest } = foundationReveal(); return rest; }],
    ['oversized text', () => ({ ...foundationReveal(), act: 'x'.repeat(5000) })],
    ['a withheld record with text', () => ({ ...foundationReveal(), status: 'withheld' })],
  ];
  for (const [label, make] of gates) {
    const r = rig({ autoJournal: true, autoRepository: true, revealRecord: make, autoReveal: true });
    await toDecision(r);
    await commit(r);
    present(r);
    await flush();
    assert.equal(phase(r), 'reveal_loading', label);
    assert.equal(r.host.getState().reveal, 'failed', `${label}: a record that fails validation is a failed load`);
    assert.equal(r.host.getStatus().reveal.error, 'invalid', label);
    assert.equal(r.host.revealRecord(), undefined, `${label}: nothing to render`);
    assert.equal(r.host.getState().decision?.option, 'act_speak', `${label}: the act is kept`);
    // Issues are paths and codes only: never the private text.
    const issues = (r.host.getStatus().reveal.issues ?? []).join('|');
    for (const c of FOUNDATION_REVEAL_CANARIES) assert.equal(issues.includes(c), false, label);
    assert.equal(issues.includes('script'), false, label);
  }
})();
ok('A loader result is validated at runtime: wrong identity, version, status, keys, markup, URLs, option or emptiness all fail closed with codes only');

await (async () => {
  // Fail closed when the loader or binding is absent; never a success.
  for (const [label, patch] of [
    ['no loader', { loadReveal: undefined }],
    ['no binding', { reveal: undefined }],
  ] as const) {
    const r = rig({ autoJournal: true, autoRepository: true });
    const cfg = { ...r.config, ...patch } as unknown as HostConfig;
    const host = new ExperienceHost(r.m, cfg, { attemptId: 'a1' });
    const rr = { ...r, host } as Rig;
    await toDecision(rr);
    await commit(rr);
    present(rr);
    await flush();
    assert.equal(host.getState().phase, 'reveal_loading', label);
    assert.equal(host.getState().reveal, 'failed', label);
    assert.equal(host.getStatus().reveal.error, 'unconfigured', label);
    assert.equal(host.revealRecord(), undefined, label);
  }
  // A loader that rejects, then retry succeeds through the reducer.
  const r = rig({ autoJournal: true, autoRepository: true });
  await toDecision(r);
  await commit(r);
  present(r);
  await flush();
  r.reveals[0].d.reject(new Error('503'));
  await flush();
  assert.deepEqual([phase(r), r.host.getState().reveal, r.host.getStatus().reveal.error], ['reveal_loading', 'failed', 'load_failed']);
  assert.equal(r.host.retryReveal(), true);
  await flush();
  r.reveals[1].d.resolve(foundationReveal());
  await flush();
  assert.equal(phase(r), 'revealed');
  assert.equal(r.host.retryReveal(), false, 'nothing to retry once loaded');
  // A late resolution of the first (failed) request cannot overwrite anything.
  r.reveals[0].d.resolve({ ...foundationReveal(), act: 'a different account' });
  await flush();
  assert.notEqual(r.host.revealRecord()?.act, 'a different account');
  // A load completing after unmount is dropped.
  const u = rig({ autoJournal: true, autoRepository: true });
  await toDecision(u);
  await commit(u);
  present(u);
  await flush();
  const pending = u.reveals[0];
  assert.equal(pending.req.signal.aborted, false);
  u.host.detach();
  assert.equal(pending.req.signal.aborted, true);
  pending.d.resolve(foundationReveal());
  await flush();
  assert.equal(phase(u), 'reveal_loading');
  assert.equal(u.host.revealRecord(), undefined);
})();
ok('No loader or no binding fails closed; rejection and retry work; late and post-unmount loads are dropped');

await (async () => {
  // A completed story re-resolves its record: a stored "ready" is not the record.
  const a = rig({ autoJournal: true, autoRepository: true, autoReveal: true });
  await toDecision(a);
  await commit(a);
  present(a);
  await flush();
  assert.equal(phase(a), 'revealed');
  const stored = JSON.parse(JSON.stringify(a.host.getState()));
  assert.equal(stored.reveal, 'ready');
  const b = rig({ autoPreload: true, host: { restore: stored } });
  b.host.attach();
  await flush();
  assert.equal(b.host.getState().phase, 'revealed');
  assert.equal(b.host.revealRecord(), undefined, 'restored as completed, but the record is not in the snapshot');
  assert.equal(b.reveals.length, 1, 'the host asks for it again');
  b.reveals[0].d.resolve(foundationReveal());
  await flush();
  assert.ok(b.host.revealRecord());
  // And if it cannot be loaded, the completed story shows a retry, not an empty success.
  const c = rig({ autoPreload: true, host: { restore: stored } });
  c.host.attach();
  await flush();
  c.reveals[0].d.reject(new Error('x'));
  await flush();
  assert.equal(c.host.getStatus().reveal.state, 'failed');
  assert.equal(c.host.retryReveal(), true);
  await flush();
  c.reveals[1].d.resolve(foundationReveal());
  await flush();
  assert.ok(c.host.revealRecord());
})();
ok('A story restored as completed re-resolves and re-validates its private record; failure offers retry, never an empty account');

await (async () => {
  // Version mapping: a control (its own manifest revision) maps explicitly onto the story's one record, with the launch profile enforced.
  for (const variant of ['rich', 'compressed'] as const) {
    const m = correctionManifest(variant);
    const mk = (record: () => unknown, binding = correctionRevealBinding()) => rig({ m, binding, autoJournal: true, autoRepository: true, autoReveal: true, revealRecord: record });
    const drive = async (r: Rig) => {
      // The canonical walk is covered elsewhere; here the reducer is advanced directly to the boundary.
      const { walkCorrectionToBoundary } = await import('./lib/hostWalk.ts');
      await walkCorrectionToBoundary(r.host, variant, async () => { const p = last(r.preloads); p.d.resolve({ sceneId: p.req.sceneId }); await flush(); });
      present(r);
      await flush();
    };
    const good = mk(() => correctionReveal());
    await drive(good);
    assert.equal(good.host.getState().phase, 'revealed', `${variant}: the shared record loads for this manifest revision (${m.revision} ↔ ${correctionRevealBinding().recordRevision})`);
    // The launch profile is stricter than the generic contract.
    const notEditorial = mk(() => ({ ...correctionReveal(), status: 'author_account' }));
    await drive(notEditorial);
    assert.equal(notEditorial.host.getStatus().reveal.error, 'invalid', `${variant}: wrong status for the profile`);
    const lacksAftermath = mk(() => { const { aftermath: _a, ...rest } = correctionReveal(); return rest; });
    await drive(lacksAftermath);
    assert.equal(lacksAftermath.host.getStatus().reveal.error, 'invalid', `${variant}: a required field is missing`);
    const wrongSources = mk(() => ({ ...correctionReveal(), sourceRefs: ['r01'] }));
    await drive(wrongSources);
    assert.equal(wrongSources.host.getStatus().reveal.error, 'invalid', `${variant}: sources differ from the profile`);
    const wrongBinding = mk(() => correctionReveal(), { ...correctionRevealBinding(), recordRevision: m.revision === 'gold-1' ? 'gold-1-compressed' : 'gold-9' });
    await drive(wrongBinding);
    assert.equal(wrongBinding.host.getStatus().reveal.error, 'invalid', `${variant}: a binding that names another record revision fails`);
    // The private text of the Correction never appears in anything the host exposes before the story is revealed.
    const early = mk(() => correctionReveal());
    early.host.attach();
    await flush();
    const exposed = JSON.stringify([early.host.getState(), early.host.getStatus(), early.host.identity(), early.m]);
    for (const c of CORRECTION_REVEAL_CANARIES) assert.equal(exposed.toLowerCase().includes(c.toLowerCase()), false);
  }
})();
ok('Version mapping: both Correction variants load the one record by explicit binding; the gold-1 profile and revision are enforced; canaries stay out of public host state');

console.log(`\nAll ${n} V3 host contract checks passed.`);
