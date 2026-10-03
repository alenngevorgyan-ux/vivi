/**
 * The V3 experience host: the one place where the pure reducer meets asynchronous work.
 *
 * Plain TypeScript, no React and no DOM, so every contract is testable in Node
 * with deferred promises. It performs the reducer's effects through the
 * injected host contracts (hostContracts.ts) and reports results back ONLY as
 * ordinary controller events, each guarded by the live mount generation, the
 * attempt and — for scene swaps — the current transaction id:
 *
 *   preload_scene    → preloadScene() → TRANSITION_READY / TRANSITION_FAILED
 *   persist_decision → journal.write() + repository.record() → DECISION_RECORDED(ack)
 *   enact            → (renderer receipts) ENACTED → HOLD_DONE → boundary presented
 *   boundary         → BOUNDARY_DONE only when presented AND (where required) durably accepted
 *   load_reveal      → loadReveal() → validateRevealRecord() → REVEAL_LOADED / REVEAL_FAILED
 *
 * It owns no story state: the snapshot is the reducer's. Host status
 * (loading/saving/failure) and the validated private record are host-private.
 * It never fetches, stores or times anything on its own: every side effect is
 * an injected function, and there are no causal timers.
 */

import type { PlaybackManifestV3, RevealRecordV3 } from '../../../engine/v3/contracts/manifest.ts';
import { validateRevealRecord } from '../../../engine/v3/contracts/reveal.ts';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state.ts';
import { isPaused } from '../../../engine/v3/ClockService.ts';
import { createExperience, restoreSnapshot, step, type ControllerEffect, type ExperienceEvent, type StepResult } from '../../../engine/v3/ExperienceController.ts';
import type { DecisionAck, DecisionOperation, HostConfig, HostIdentity, HostStatus, JournalEntry, PresentationToken, ReceiptResult } from './hostContracts.ts';

/** Call a host function so a synchronous throw and a rejected promise are handled identically. */
function attempt<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e);
  }
}

const isRec = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const VISUAL_REQUIRED = ['preloadScene', 'repository', 'journal', 'loadReveal', 'reveal'] as const;

export const decisionKey = (o: Omit<DecisionOperation, 'key'>) => `v3:${o.experienceId}:${o.decisionVersion}:${o.attemptId}:${o.option}`;

export interface HostOptions {
  attemptId?: string;
  /** A stored snapshot to resume. Validated; an invalid one starts fresh. */
  restore?: unknown;
  /** Every dispatched event and its result (diagnostics, input-scope sync). */
  onStep?: (event: ExperienceEvent, result: StepResult) => void;
}

export class ExperienceHost {
  readonly manifest: PlaybackManifestV3;
  readonly config: HostConfig;
  private s: RuntimeSnapshot;
  private mount = 0;
  private attached = false;
  private aborts = new Set<AbortController>();
  private listeners = new Set<() => void>();
  private record?: RevealRecordV3;
  private boundaryReceipt?: PresentationToken;
  private explicitlyRestored: boolean;
  private st: HostStatus;
  private opts: HostOptions;

  constructor(manifest: PlaybackManifestV3, config: HostConfig, opts: HostOptions = {}) {
    this.manifest = manifest;
    this.config = config;
    this.opts = opts;
    const restored = opts.restore !== undefined ? restoreSnapshot(manifest, opts.restore) : undefined;
    this.explicitlyRestored = !!restored;
    this.s = restored ?? createExperience(manifest, { attemptId: opts.attemptId ?? `attempt-${Date.now().toString(36)}` });
    const missing = config.mode === 'visual' ? VISUAL_REQUIRED.filter(k => !config[k]) : [];
    this.st = {
      config: { missing: [...missing] },
      recovery: 'none',
      entry: 'idle',
      transition: { state: 'idle' },
      persistence: { journal: 'idle', repository: 'idle', attempts: 0, durable: false },
      revealGate: 'closed',
      reveal: { state: 'idle' },
    };
  }

  /* ------------------------------------------------------------ reading --- */

  getState(): RuntimeSnapshot {
    return this.s;
  }
  getStatus(): HostStatus {
    return this.st;
  }
  /** The validated private record — only once the story is revealed. Never part of the snapshot or the hooks. */
  revealRecord(): RevealRecordV3 | undefined {
    return (this.s.phase === 'revealed' || this.s.phase === 'ended') && this.record ? structuredClone(this.record) : undefined;
  }
  identity(): HostIdentity {
    return { experienceId: this.manifest.experienceId, manifestRevision: this.manifest.revision, decisionVersion: this.manifest.decisionVersion, assetRevisions: { ...this.manifest.assetRevisions }, attemptId: this.s.attemptId, mount: this.mount };
  }
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach(fn => fn());
  }
  private setStatus(patch: (s: HostStatus) => HostStatus) {
    this.st = patch(this.st);
    this.notify();
  }

  /* ---------------------------------------------------------- lifecycle --- */

  /** Mount: a new generation. Recovers, prepares the entry scene, resumes persistence and private records. */
  attach(): void {
    this.mount++;
    this.attached = true;
    // Work started by an earlier mount was dropped by detach(): its statuses must not block a restart.
    this.st = {
      ...this.st,
      entry: this.st.entry === 'preparing' ? 'idle' : this.st.entry,
      transition: this.st.transition.state === 'preparing' ? { state: 'idle' } : this.st.transition,
      persistence: {
        ...this.st.persistence,
        journal: this.st.persistence.journal === 'writing' ? 'idle' : this.st.persistence.journal,
        repository: this.st.persistence.repository === 'saving' ? 'idle' : this.st.persistence.repository,
      },
      reveal: this.st.reveal.state === 'loading' ? { state: 'idle' } : this.st.reveal,
    };
    this.boundaryReceipt = undefined;
    void this.start(this.mount);
  }

  /** Unmount / revision change: every pending callback of this generation is now stale, and work is aborted. */
  detach(): void {
    this.attached = false;
    this.mount++;
    this.aborts.forEach(a => a.abort());
    this.aborts.clear();
  }

  private live(mount: number, attemptId: string): boolean {
    return this.attached && mount === this.mount && attemptId === this.s.attemptId;
  }
  private schedule(fn: () => void) {
    (this.config.schedule ?? queueMicrotask)(fn);
  }
  private abortable(): AbortController {
    const a = new AbortController();
    this.aborts.add(a);
    return a;
  }

  private async start(mount: number) {
    const attemptId = this.s.attemptId;
    // 1. A reload with no explicit snapshot: recover an accepted choice from the durable journal.
    if (!this.explicitlyRestored && this.s.phase === 'loading' && !this.s.decision && this.config.journal) {
      const entry = await attempt(() => this.config.journal!.read({ experienceId: this.manifest.experienceId, manifestRevision: this.manifest.revision, decisionVersion: this.manifest.decisionVersion })).catch(() => undefined);
      if (!this.live(mount, attemptId)) return;
      if (entry !== undefined) {
        const recovered = this.recover(entry);
        this.setStatus(s => ({ ...s, recovery: recovered ? 'recovered' : 'ignored_invalid' }));
      }
    }
    if (!this.live(mount, this.s.attemptId)) return;
    // 2. The first (or restored) scene goes through the same preparation contract as any portal.
    if (this.s.phase === 'loading') this.prepareEntry();
    // 3. An accepted choice that is not yet recorded is re-journaled and re-sent with the identical key.
    if (this.s.decision && this.s.decision.status !== 'recorded') this.persist();
    // 3b. A mount that interrupted work resumes it: a portal's preparation, the presentation, the private record.
    const tx = this.s.transition;
    if (this.s.phase === 'transitioning' && tx) this.prepareTransition(tx.toScene, tx.id);
    if (this.config.mode === 'headless' && (this.s.phase === 'enacting' || this.s.phase === 'holding' || this.s.phase === 'boundary')) this.schedule(() => this.runHeadlessPresentation());
    if (this.s.phase === 'reveal_loading' && this.s.reveal === 'loading') this.loadReveal(true);
    // 4. A completed story re-resolves its private record: a stored `ready` is not the record.
    if ((this.s.phase === 'revealed' || this.s.phase === 'ended') && !this.record) this.loadReveal(false);
    this.updateGate();
  }

  /** Accept a journal entry only if it is exactly this experience, decision version, attempt and option. */
  private recover(raw: unknown): boolean {
    if (!isRec(raw) || !isRec(raw.op)) return false;
    const op = raw.op as unknown as DecisionOperation;
    const m = this.manifest;
    if (op.experienceId !== m.experienceId || op.manifestRevision !== m.revision || op.decisionVersion !== m.decisionVersion) return false;
    const snap = restoreSnapshot(m, raw.snapshot);
    if (!snap?.decision || snap.attemptId !== op.attemptId || snap.decision.id !== op.decisionId || snap.decision.option !== op.option) return false;
    if (op.key !== decisionKey(op)) return false;
    this.s = snap;
    this.notify();
    return true;
  }

  /* ----------------------------------------------------------- dispatch --- */

  dispatch(e: ExperienceEvent): StepResult {
    const r = step(this.manifest, this.s, e);
    const changed = r.state !== this.s;
    if (changed) this.s = r.state;
    this.opts.onStep?.(e, r);
    if (changed || !r.rejected) this.notify();
    if (!r.rejected) {
      r.effects.forEach(eff => this.perform(eff));
      this.updateGate();
    }
    return r;
  }

  private perform(eff: ControllerEffect) {
    switch (eff.type) {
      case 'preload_scene':
        return this.prepareTransition(eff.scene, eff.txId);
      case 'persist_decision':
        return this.persist();
      case 'enact':
        if (this.config.mode === 'headless') this.schedule(() => this.runHeadlessPresentation());
        return; // a visual renderer reports each phase through the receipts below
      case 'load_reveal':
        return this.loadReveal(true);
      case 'save_snapshot':
        this.config.onSave?.(this.s);
        return;
      case 'focus_handoff':
      case 'diagnostic':
        return;
    }
  }

  /* ------------------------------------------------------- preparation --- */

  private prepareEntry() {
    const mount = this.mount;
    const attemptId = this.s.attemptId;
    const sceneId = this.s.scene;
    const ready = () => {
      if (!this.live(mount, attemptId) || this.s.phase !== 'loading' || this.s.scene !== sceneId) return;
      this.setStatus(s => ({ ...s, entry: 'ready' }));
      this.dispatch({ type: 'LOADED' });
    };
    if (!this.config.preloadScene) {
      if (this.config.mode === 'headless') return this.schedule(ready);
      return this.setStatus(s => ({ ...s, entry: 'failed' }));
    }
    this.setStatus(s => ({ ...s, entry: 'preparing' }));
    const a = this.abortable();
    attempt(() => this.config.preloadScene!({ sceneId, txId: 'entry', identity: this.identity(), signal: a.signal })).then(
      prepared => {
        this.aborts.delete(a);
        if (!this.live(mount, attemptId)) return;
        if (!isRec(prepared) || prepared.sceneId !== sceneId) return this.setStatus(s => ({ ...s, entry: 'failed' }));
        ready();
      },
      () => {
        this.aborts.delete(a);
        if (this.live(mount, attemptId)) this.setStatus(s => ({ ...s, entry: 'failed' }));
      }
    );
  }

  /** Retry a failed entry preparation (the shell's retry control). */
  retryEntry(): void {
    if (this.attached && this.s.phase === 'loading' && this.st.entry === 'failed') this.prepareEntry();
  }

  private prepareTransition(sceneId: string, txId: string) {
    const mount = this.mount;
    const attemptId = this.s.attemptId;
    // Only the transaction that is still current may complete; tx ids recur across attempts and mounts.
    const current = () => this.live(mount, attemptId) && this.s.phase === 'transitioning' && this.s.transition?.id === txId;
    const failed = (error: NonNullable<HostStatus['transition']['error']>) => {
      if (!current()) return;
      this.setStatus(s => ({ ...s, transition: { state: 'failed', txId, error } }));
      this.dispatch({ type: 'TRANSITION_FAILED', txId });
    };
    if (!this.config.preloadScene) {
      // Headless may complete at once; a visual host without a loader has NOT prepared anything.
      if (this.config.mode === 'headless') return this.schedule(() => current() && (this.setStatus(s => ({ ...s, transition: { state: 'idle' } })), this.dispatch({ type: 'TRANSITION_READY', txId })));
      return this.schedule(() => failed('unconfigured'));
    }
    this.setStatus(s => ({ ...s, transition: { state: 'preparing', txId } }));
    const a = this.abortable();
    attempt(() => this.config.preloadScene!({ sceneId, txId, identity: this.identity(), signal: a.signal })).then(
      prepared => {
        this.aborts.delete(a);
        if (!current()) return; // stale: unmounted, another attempt, or a superseded transaction
        if (!isRec(prepared) || prepared.sceneId !== sceneId) return failed('invalid_prepared');
        this.setStatus(s => ({ ...s, transition: { state: 'idle' } }));
        this.dispatch({ type: 'TRANSITION_READY', txId });
      },
      () => {
        this.aborts.delete(a);
        failed('load_failed');
      }
    );
  }

  /* ----------------------------------------------------- presentation --- */

  /** The token a renderer must hand back with the receipt for the phase it is presenting now. */
  receiptToken(): PresentationToken | undefined {
    const p = this.s.phase;
    if (p !== 'enacting' && p !== 'holding' && p !== 'boundary') return undefined;
    return { mount: this.mount, attemptId: this.s.attemptId, decisionId: this.s.decision?.id, option: this.s.decision?.option, phase: p };
  }

  private check(t: PresentationToken | undefined, phase: PresentationToken['phase']): ReceiptResult {
    if (!this.attached) return { ok: false, reason: 'detached' };
    if (!t || t.mount !== this.mount || t.attemptId !== this.s.attemptId || t.decisionId !== this.s.decision?.id || t.option !== this.s.decision?.option) return { ok: false, reason: 'stale' };
    if (t.phase !== phase || this.s.phase !== phase) return { ok: false, reason: 'wrong_phase' };
    // A hidden page renders nothing, so nothing it "completed" can be a receipt.
    if (isPaused(this.s.time, 'hidden')) return { ok: false, reason: 'hidden' };
    return { ok: true };
  }
  private send(e: ExperienceEvent): ReceiptResult {
    return this.dispatch(e).rejected ? { ok: false, reason: 'rejected' } : { ok: true };
  }

  /** The hero's act reached its exact stop pose with the complete intention caption. */
  enacted(t: PresentationToken | undefined): ReceiptResult {
    const c = this.check(t, 'enacting');
    return c.ok ? this.send({ type: 'ENACTED' }) : c;
  }
  /** The held stop trace finished (or was skipped by the reader). */
  held(t: PresentationToken | undefined): ReceiptResult {
    const c = this.check(t, 'holding');
    return c.ok ? this.send({ type: 'HOLD_DONE' }) : c;
  }
  /** The boundary withdrawal/bridge finished. The account opens once acceptance is durable (where required). */
  boundaryPresented(t: PresentationToken | undefined): ReceiptResult {
    const c = this.check(t, 'boundary');
    if (!c.ok) return c;
    this.boundaryReceipt = t;
    this.updateGate();
    return { ok: true };
  }
  /**
   * Deterministic skip. During the act or the hold: install the final still/caption, then the reducer's SKIP
   * reaches the same boundary. During the boundary: the bridge counts as presented.
   */
  skip(): ReceiptResult {
    const p = this.s.phase;
    if (p === 'enacting' || p === 'holding') {
      const c = this.check(this.receiptToken(), p);
      return c.ok ? this.send({ type: 'SKIP' }) : c;
    }
    if (p === 'boundary') return this.boundaryPresented(this.receiptToken());
    return { ok: false, reason: 'wrong_phase' };
  }

  /** Renderer-less presentation: explicitly the headless host only. */
  private runHeadlessPresentation() {
    if (this.config.mode !== 'headless') return;
    this.enacted(this.receiptToken());
    this.held(this.receiptToken());
    this.boundaryPresented(this.receiptToken());
  }

  /** The reveal gate. BOUNDARY_DONE needs the presented boundary and, where required, durable acceptance. */
  private updateGate() {
    const s = this.s;
    let gate: HostStatus['revealGate'] = 'closed';
    if (s.phase === 'boundary') {
      const presented = !!this.boundaryReceipt && this.boundaryReceipt.mount === this.mount && this.boundaryReceipt.attemptId === s.attemptId;
      const needDurable = !!s.decision && (this.config.mode === 'visual' || this.config.requireDurableAcceptance === true);
      gate = !presented ? 'waiting_for_presentation' : needDurable && !this.st.persistence.durable ? 'waiting_for_durable_acceptance' : 'released';
      if (gate === 'released' && this.attached) {
        this.boundaryReceipt = undefined;
        if (this.st.revealGate !== 'released') this.st = { ...this.st, revealGate: 'released' };
        this.dispatch({ type: 'BOUNDARY_DONE' });
        return;
      }
    } else if (s.phase === 'reveal_loading' || s.phase === 'revealed' || s.phase === 'ended') gate = 'released';
    if (gate !== this.st.revealGate) this.setStatus(x => ({ ...x, revealGate: gate }));
  }

  /* ------------------------------------------------------- persistence --- */

  private operation(): DecisionOperation | undefined {
    const d = this.s.decision;
    if (!d) return undefined;
    const base = { experienceId: this.manifest.experienceId, manifestRevision: this.manifest.revision, decisionVersion: this.manifest.decisionVersion, decisionId: d.id, option: d.option, attemptId: this.s.attemptId };
    return { key: decisionKey(base), ...base };
  }

  /**
   * Journal first (local durability), then the repository (the ack). The accepted choice is already immutable in
   * the snapshot; nothing here can change or clear it. Only an ack naming the exact operation records it.
   */
  private persist() {
    const op = this.operation();
    if (!op) return;
    const mount = this.mount;
    const p = this.st.persistence;
    this.setStatus(s => ({ ...s, persistence: { ...s.persistence, key: op.key, error: undefined } }));

    if (p.journal !== 'written' && p.journal !== 'writing') {
      if (!this.config.journal) this.patchPersistence({ journal: 'unconfigured' });
      else {
        this.patchPersistence({ journal: 'writing' });
        const entry: JournalEntry = { op, snapshot: JSON.parse(JSON.stringify(this.s)) };
        attempt(() => this.config.journal!.write(entry)).then(
          () => mount === this.mount && this.patchPersistence({ journal: 'written' }),
          () => mount === this.mount && this.patchPersistence({ journal: 'failed', error: 'journal_failed' })
        );
      }
    }

    if (this.s.decision?.status !== 'recorded' && p.repository !== 'saving' && p.repository !== 'recorded') {
      if (!this.config.repository) this.patchPersistence({ repository: 'unconfigured' });
      else {
        this.patchPersistence({ repository: 'saving', attempts: this.st.persistence.attempts + 1 });
        attempt(() => this.config.repository!.record(op)).then(
          ack => {
            if (mount !== this.mount) return;
            if (!ackMatches(ack, op)) return this.patchPersistence({ repository: 'failed', error: 'ack_mismatch' });
            this.patchPersistence({ repository: 'recorded' });
            this.dispatch({ type: 'DECISION_RECORDED', decision: op.decisionId, option: op.option });
          },
          () => mount === this.mount && this.patchPersistence({ repository: 'failed', error: 'repository_failed' })
        );
      }
    }
  }

  private patchPersistence(patch: Partial<HostStatus['persistence']>) {
    this.setStatus(s => {
      const next = { ...s.persistence, ...patch };
      next.durable = next.journal === 'written' || next.repository === 'recorded';
      return { ...s, persistence: next };
    });
    this.updateGate();
  }

  /** The shell's "Retry" after a failed save: the identical operation and key, never a second choice. */
  retryPersistence(): boolean {
    const p = this.st.persistence;
    if (!this.attached || !this.s.decision || (p.journal !== 'failed' && p.repository !== 'failed')) return false;
    this.patchPersistence({
      ...(p.journal === 'failed' ? { journal: 'idle' as const } : {}),
      ...(p.repository === 'failed' ? { repository: 'idle' as const } : {}),
    });
    this.persist();
    return true;
  }

  /* ----------------------------------------------------- private reveal --- */

  private loadReveal(viaReducer: boolean) {
    const mount = this.mount;
    const attemptId = this.s.attemptId;
    const m = this.manifest;
    const binding = this.config.reveal;
    const stillWanted = () => this.live(mount, attemptId) && (viaReducer ? this.s.phase === 'reveal_loading' : this.s.phase === 'revealed' || this.s.phase === 'ended');
    const fail = (error: NonNullable<HostStatus['reveal']['error']>, issues?: string[]) => {
      if (!stillWanted()) return;
      this.record = undefined;
      this.setStatus(s => ({ ...s, reveal: { state: 'failed', error, ...(issues ? { issues } : {}) } }));
      if (viaReducer) this.dispatch({ type: 'REVEAL_FAILED' });
    };
    // No loader, or no trusted binding: there is no record, so there is no account. Never a success.
    if (!this.config.loadReveal || !binding) return this.schedule(() => fail('unconfigured'));
    this.setStatus(s => ({ ...s, reveal: { state: 'loading' } }));
    const a = this.abortable();
    attempt(() => this.config.loadReveal!({ experienceId: m.experienceId, manifestRevision: m.revision, revealRef: binding.revealRef, recordRevision: binding.recordRevision, signal: a.signal })).then(
      raw => {
        this.aborts.delete(a);
        if (!stillWanted()) return;
        const v = validateRevealRecord(raw, { experienceId: m.experienceId, recordRevision: binding.recordRevision, options: m.primaryDecision?.options ?? null, profile: binding.profile });
        if (!v.ok) return fail('invalid', v.issues.map(i => `${i.path}:${i.code}`));
        this.record = Object.freeze(structuredClone(v.value));
        this.setStatus(s => ({ ...s, reveal: { state: 'ready' } }));
        if (viaReducer) this.dispatch({ type: 'REVEAL_LOADED' });
      },
      () => {
        this.aborts.delete(a);
        fail('load_failed');
      }
    );
  }

  /** The shell's "Retry author account": reload through the reducer, or re-resolve a completed story's record. */
  retryReveal(): boolean {
    if (!this.attached) return false;
    if (this.s.phase === 'reveal_loading' && this.s.reveal === 'failed') return !this.dispatch({ type: 'RETRY_REVEAL' }).rejected;
    if ((this.s.phase === 'revealed' || this.s.phase === 'ended') && !this.record) {
      this.loadReveal(false);
      return true;
    }
    return false;
  }
}

function ackMatches(ack: unknown, op: DecisionOperation): ack is DecisionAck {
  return isRec(ack) && ack.key === op.key && ack.decisionId === op.decisionId && ack.option === op.option;
}
