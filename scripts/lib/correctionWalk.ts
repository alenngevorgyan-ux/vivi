/**
 * Canonical headless walks through THE CORRECTION, shared by
 * scripts/test-v3-correction.ts and scripts/trace-v3-correction.ts.
 *
 * Only this fixture-side code knows which experience it is driving; the
 * reducer, the readable projection and the host are generic.
 */

import assert from 'node:assert/strict';
import type { ExperienceEvent, StepResult } from '../../src/engine/v3/ExperienceController.ts';
import { correctionManifest, type CorrectionVariant } from '../../src/data/experienceV3Fixtures/runtime/theCorrection.ts';
import { correctionRevealBinding, resolveCorrectionReveal } from '../../src/data/experienceV3Fixtures/runtime/theCorrection.reveal.ts';
import { HeadlessHost, type HostOptions } from './v3HeadlessHost.ts';

export type CorrectionOption = 'correct_public' | 'request_private' | 'pass_question';
export const CORRECTION_OPTIONS: readonly CorrectionOption[] = ['correct_public', 'request_private', 'pass_question'];

export function correctionHost(variant: CorrectionVariant = 'rich', opts: Partial<HostOptions> = {}): HeadlessHost {
  return new HeadlessHost(correctionManifest(variant), { resolveReveal: resolveCorrectionReveal, binding: correctionRevealBinding(), ...opts });
}

export const expectOk = (res: StepResult, what: string) => assert.equal(res.rejected, undefined, `${what}: rejected as ${res.rejected?.code}`);
export const expectRejected = (res: StepResult, code: string, what: string = code) => assert.equal(res.rejected?.code, code, `${what}: expected ${code}, got ${res.rejected?.code ?? 'accepted'}`);

/** Send and require acceptance. */
export function ok(h: HeadlessHost, e: ExperienceEvent, what: string = e.type): StepResult {
  const r = h.send(e);
  expectOk(r, what);
  return r;
}

export const advance = (h: HeadlessHost, what = 'advance') => ok(h, { type: 'ADVANCE', activationId: h.aid() }, what);
export const travel = (h: HeadlessHost, portal: string) => {
  const r = ok(h, { type: 'REQUEST_PORTAL', id: portal, activationId: h.aid() }, `travel ${portal}`);
  assert.equal(h.s.phase, 'playing', `travel ${portal} completes (preload → swap → entered)`);
  return r;
};
export const observe = (h: HeadlessHost, id: string) => {
  ok(h, { type: 'OPEN_OBSERVATION', id, activationId: h.aid() }, `open ${id}`);
  ok(h, { type: 'CLOSE_OBSERVATION' }, `close ${id}`);
};

export interface WalkOptions {
  /** Read the deck title through its observation as well as the reader checkpoint. */
  observeTitle?: boolean;
  /** Inspect the optional summary (F10) in the hallway (rich) or meeting (compressed). */
  observeSummary?: boolean;
  /** Rich only: hallway → room → hallway round trips during the break. */
  roomVisits?: number;
  position?: 'seat' | 'near' | 'none';
}

/** Load and play to the decision plateau: every required receipt, the question asked, nothing chosen. */
export function walkToDecision(h: HeadlessHost, variant: CorrectionVariant, o: WalkOptions = {}) {
  ok(h, { type: 'LOADED' });
  ok(h, { type: 'ENTERED' });
  advance(h, 'ev_desk_context');
  if (o.observeTitle) observe(h, 'obs_title');
  advance(h, 'ev_title');
  travel(h, 'cut_to_meeting');
  advance(h, 'ev_arrive_meeting');
  advance(h, 'ev_board');
  advance(h, 'ev_recognize');
  advance(h, 'ev_break');
  if (variant === 'rich') {
    travel(h, 'start_break');
    advance(h, 'ev_hall_context');
    if (o.observeSummary) observe(h, 'obs_summary');
    for (let i = 0; i < (o.roomVisits ?? 0); i++) {
      travel(h, 'p_room');
      travel(h, 'p_hall');
    }
    travel(h, 'resume_meeting');
  } else {
    advance(h, 'ev_hall_context');
    if (o.observeSummary) observe(h, 'obs_summary');
  }
  advance(h, 'ev_resume');
  advance(h, 'ev_question');
  if (o.position === 'near') ok(h, { type: 'APPLY_PREPARATION', id: 'prep_near', activationId: h.aid() });
  if (o.position === 'seat') ok(h, { type: 'APPLY_PREPARATION', id: 'prep_seat', activationId: h.aid() });
}

/** Select, optionally cancel once, then accept with a separate activation. */
export function commit(h: HeadlessHost, option: CorrectionOption, cancelFirst = false) {
  if (cancelFirst) {
    ok(h, { type: 'REQUEST_INTENT', id: option, activationId: h.aid() }, `select ${option}`);
    ok(h, { type: 'CANCEL' }, 'keep considering');
  }
  ok(h, { type: 'REQUEST_INTENT', id: option, activationId: h.aid() }, `select ${option}`);
  ok(h, { type: 'CONFIRM', id: option, activationId: h.aid() }, `confirm ${option}`);
}

/** Enactment → hold → boundary → reveal → end, or a visual skip straight to the boundary. */
export function finish(h: HeadlessHost, skip = false) {
  if (skip) ok(h, { type: 'SKIP' });
  else {
    ok(h, { type: 'ENACTED' });
    ok(h, { type: 'HOLD_DONE' });
  }
  ok(h, { type: 'BOUNDARY_DONE' });
  assert.equal(h.s.phase, 'revealed', 'the host resolved the author record');
  ok(h, { type: 'END' });
}

/** The full canonical run used by the dev trace and the determinism checks. */
export function canonicalRun(variant: CorrectionVariant, option: CorrectionOption, o: WalkOptions & { cancelFirst?: boolean; skip?: boolean } = {}): HeadlessHost {
  const h = correctionHost(variant);
  walkToDecision(h, variant, o);
  commit(h, option, o.cancelFirst);
  finish(h, o.skip);
  return h;
}
