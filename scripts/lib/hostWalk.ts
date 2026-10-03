/**
 * The canonical Correction walk driven through the asynchronous ExperienceHost (not the synchronous trace host).
 * The caller supplies `prepare`, which resolves whatever preparation the host is currently waiting for.
 */

import assert from 'node:assert/strict';
import type { ExperienceHost } from '../../src/components/experience/v3/ExperienceHost.ts';
import type { ExperienceEvent } from '../../src/engine/v3/ExperienceController.ts';
import type { CorrectionVariant } from '../../src/data/experienceV3Fixtures/runtime/theCorrection.ts';

const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise<void>(r => setImmediate(r));
};

/** Load, play every required receipt, ask the question and accept `correct_public`. Leaves the host enacting. */
export async function walkCorrectionToBoundary(host: ExperienceHost, variant: CorrectionVariant, prepare: () => Promise<void>, option = 'correct_public'): Promise<void> {
  let n = 0;
  const aid = () => `w${++n}`;
  const ok = (e: ExperienceEvent) => assert.equal(host.dispatch(e).rejected, undefined, `${e.type} was rejected`);
  const advance = () => ok({ type: 'ADVANCE', activationId: aid() });
  const travel = async (portal: string) => {
    ok({ type: 'REQUEST_PORTAL', id: portal, activationId: aid() });
    await flush();
    await prepare();
    ok({ type: 'ENTERED' });
  };

  host.attach();
  await flush();
  await prepare();
  ok({ type: 'ENTERED' });
  advance();
  advance();
  await travel('cut_to_meeting');
  advance();
  advance();
  advance();
  advance();
  if (variant === 'rich') {
    await travel('start_break');
    advance();
    await travel('resume_meeting');
  } else advance();
  advance();
  advance();
  ok({ type: 'REQUEST_INTENT', id: option, activationId: aid() });
  ok({ type: 'CONFIRM', id: option, activationId: aid() });
  await flush();
}
