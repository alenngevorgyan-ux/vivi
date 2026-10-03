/**
 * A deterministic, headless V3 host for integration tests and the dev trace.
 *
 * It plays the part the browser shell plays: it sends player events to the
 * real reducer and performs the effects the reducer requests (preload →
 * TRANSITION_READY → ENTERED, persist_decision → DECISION_RECORDED,
 * load_reveal → REVEAL_LOADED / REVEAL_FAILED, save_snapshot). It knows no
 * story: the experience arrives as a manifest plus a reveal resolver and the
 * trusted reveal binding.
 *
 * It is the SYNCHRONOUS reducer-level model of the host contract: it
 * acknowledges exactly the accepted decision and option, and a reveal record is
 * released only after `validateRevealRecord` accepts it against the binding.
 * The asynchronous contract (deferred preload, journal, repository, stale
 * guards) is ExperienceHost's, and is tested directly in test-v3-host.ts.
 *
 * Every processed event becomes a trace row built from the readable model and
 * the snapshot. Rows never contain reveal text: once released, the record's
 * presence is reported by field name only.
 */

import type { PlaybackManifestV3, RevealRecordV3 } from '../../src/engine/v3/contracts/manifest.ts';
import type { RuntimeSnapshot } from '../../src/engine/v3/contracts/state.ts';
import { validateRevealRecord } from '../../src/engine/v3/contracts/reveal.ts';
import type { RevealBinding } from '../../src/components/experience/v3/hostContracts.ts';
import { createExperience, restoreSnapshot, step, type ControllerEffect, type ExperienceEvent, type StepResult } from '../../src/engine/v3/ExperienceController.ts';
import { buildReadableModel } from '../../src/engine/v3/readable.ts';

export interface HostOptions {
  attemptId?: string;
  resolveReveal: (experienceId: string, revision: string) => unknown;
  /** The trusted record mapping and launch profile. A record that fails it is never released. */
  binding: Pick<RevealBinding, 'recordRevision' | 'profile'>;
  /** Fault injection: the first N reveal loads fail. */
  failRevealLoads?: number;
  /** Hold preloads open instead of completing them (to test stale/late completion). */
  holdPreloads?: boolean;
  /** Resume from this stored snapshot instead of starting fresh. */
  restoreFrom?: string;
}

export interface TraceRow {
  i: number;
  by: 'player' | 'host';
  event: string;
  result: string;
  phase: string;
  scene: string;
  location: string;
  arc: number;
  newFacts: string[];
  facts: number;
  entities: Record<string, string>;
  seenObservations: string[];
  available: { portals: string[]; observations: string[]; preparations: string[]; actions: string[]; canAdvance: boolean };
  decision: string;
  locked: boolean;
  reveal: string;
}

export interface DecisionWrite {
  decisionVersion: string;
  attemptId: string;
  decision: string;
  option: string;
}

const label = (e: ExperienceEvent): string => {
  const id = 'id' in e && typeof e.id === 'string' ? ` ${e.id}` : 'txId' in e ? ` ${e.txId}` : '';
  return `${e.type}${id}`;
};

export class HeadlessHost {
  readonly m: PlaybackManifestV3;
  s: RuntimeSnapshot;
  rows: TraceRow[] = [];
  effects: ControllerEffect[] = [];
  decisions: DecisionWrite[] = [];
  snapshots: string[] = [];
  pendingPreloads: string[] = [];
  reveal?: RevealRecordV3;
  private opts: HostOptions;
  private failures: number;
  private act = 0;

  constructor(m: PlaybackManifestV3, opts: HostOptions) {
    this.m = m;
    this.opts = opts;
    this.failures = opts.failRevealLoads ?? 0;
    if (opts.restoreFrom !== undefined) {
      const r = restoreSnapshot(m, JSON.parse(opts.restoreFrom));
      if (!r) throw new Error('snapshot did not restore');
      this.s = r;
    } else this.s = createExperience(m, { attemptId: opts.attemptId ?? 'attempt_1' });
  }

  /** A fresh physical activation id, as the InputManager would issue. */
  aid(): string {
    return `h${++this.act}`;
  }

  /** Send a player event and let the host carry out whatever it requests. */
  send(e: ExperienceEvent): StepResult {
    return this.dispatch(e, 'player');
  }

  /** Complete a held preload (or a stale one, to prove it is refused). */
  completePreload(txId: string): StepResult {
    this.pendingPreloads = this.pendingPreloads.filter(t => t !== txId);
    return this.dispatch({ type: 'TRANSITION_READY', txId }, 'host');
  }

  private dispatch(e: ExperienceEvent, by: 'player' | 'host'): StepResult {
    const before = this.s;
    const res = step(this.m, this.s, e);
    this.s = res.state;
    this.effects.push(...res.effects);
    this.rows.push(this.row(e, by, res, before));
    for (const eff of res.effects) this.perform(eff);
    return res;
  }

  private perform(eff: ControllerEffect) {
    switch (eff.type) {
      case 'save_snapshot':
        this.snapshots.push(JSON.stringify(this.s));
        return;
      case 'preload_scene':
        if (this.opts.holdPreloads) this.pendingPreloads.push(eff.txId);
        else this.dispatch({ type: 'TRANSITION_READY', txId: eff.txId }, 'host');
        return;
      case 'focus_handoff':
        this.dispatch({ type: 'ENTERED' }, 'host');
        return;
      case 'persist_decision':
        // First-choice storage is keyed to the decision version; a replay or duplicate never overwrites it.
        if (!this.decisions.some(d => d.decisionVersion === this.m.decisionVersion && d.attemptId === this.s.attemptId)) {
          this.decisions.push({ decisionVersion: this.m.decisionVersion, attemptId: this.s.attemptId, decision: eff.decision, option: eff.option });
        }
        // The acknowledgement names exactly this decision and option; anything else is rejected by the reducer.
        this.dispatch({ type: 'DECISION_RECORDED', decision: eff.decision, option: eff.option }, 'host');
        return;
      case 'load_reveal': {
        if (this.failures > 0) {
          this.failures--;
          this.dispatch({ type: 'REVEAL_FAILED' }, 'host');
          return;
        }
        const raw = this.opts.resolveReveal(eff.experienceId, eff.revision);
        const v = validateRevealRecord(raw, { experienceId: this.m.experienceId, recordRevision: this.opts.binding.recordRevision, options: this.m.primaryDecision?.options ?? null, profile: this.opts.binding.profile });
        if (!v.ok) {
          this.dispatch({ type: 'REVEAL_FAILED' }, 'host');
          return;
        }
        this.reveal = v.value;
        this.dispatch({ type: 'REVEAL_LOADED' }, 'host');
        return;
      }
      case 'enact':
      case 'diagnostic':
        return;
    }
  }

  private row(e: ExperienceEvent, by: 'player' | 'host', res: StepResult, before: RuntimeSnapshot): TraceRow {
    const s = res.state;
    const r = buildReadableModel(this.m, s);
    const owner = (o: RuntimeSnapshot['entities'][number]['owner']) => (o.kind === 'offstage' ? 'offstage' : `${o.kind}:${o.id}`);
    return {
      i: this.rows.length + 1,
      by,
      event: label(e),
      result: res.rejected ? `rejected:${res.rejected.code}` : 'ok',
      phase: s.phase,
      scene: s.scene,
      location: s.location,
      arc: s.arcIndex,
      newFacts: s.receivedFacts.filter(f => !before.receivedFacts.includes(f)),
      facts: s.receivedFacts.length,
      entities: Object.fromEntries(s.entities.map(x => [x.id, owner(x.owner) + (x.state.mark_role ? `@${x.state.mark_role}` : '')])),
      seenObservations: [...s.seenObservations],
      available: {
        portals: r.portals.filter(p => p.available).map(p => p.id),
        observations: r.observations.filter(o => o.available).map(o => o.id),
        preparations: r.preparations.filter(p => p.applied).map(p => `${p.id}(applied)`),
        actions: r.actions.filter(a => a.available).map(a => a.id),
        canAdvance: r.canAdvance,
      },
      decision: s.decision ? `${s.decision.option}:${s.decision.status}` : s.reservation ? `${s.reservation.option}:reserved` : 'none',
      locked: s.boundaryLocked,
      reveal: s.reveal === 'ready' && this.reveal ? `ready(fields: ${(['act', 'why', 'aftermath'] as const).filter(k => this.reveal![k]).join(', ')}; text withheld from trace)` : s.reveal,
    };
  }
}
