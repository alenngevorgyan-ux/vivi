/**
 * THE CORRECTION — the host side of the private reveal.
 *
 * Nothing here imports the private record statically. `correctionRevealLoader` loads the private module with a
 * dynamic import only when ExperienceHost calls `loadReveal`, which it does only after the boundary has been
 * presented AND acceptance is durable (`revealGate: released`). Before that, no request, chunk or string of the
 * account exists in the page.
 *
 * Two validations, by design:
 *  - here, with the private Gold launch profile (exact author option), because that mapping is itself private;
 *  - in ExperienceHost, with the public binding below (status, required fields, sources, record revision).
 * Every variant and every chosen option resolve the same one record.
 */

import { validateRevealRecord } from '../../../engine/v3/contracts/reveal.ts';
import { CORRECTION_VERSIONS } from '../../../data/experienceV3Fixtures/runtime/theCorrection.ts';
import type { RevealBinding, RevealLoader } from './hostContracts.ts';

/** The public part of the trusted variant → record mapping. It names no option and carries no text. */
export function correctionPublicRevealBinding(): RevealBinding {
  return {
    revealRef: CORRECTION_VERSIONS.revealRef,
    recordRevision: CORRECTION_VERSIONS.recordRevision,
    profile: { status: 'fictional_editorial', requireFields: ['act', 'why', 'aftermath'], sourceRefs: ['r01', 'r02', 'r03'] },
  };
}

/** Development fault injection for the record service (browser QA). Never on in a normal run. */
export type RevealFault = 'none' | 'fail' | 'fail-once' | 'invalid' | 'invalid-once' | 'stale' | 'missing';

/** `options` are the manifest's decision options (never a second list kept here). */
export function correctionRevealLoader(options: readonly string[], fault: () => RevealFault = () => 'none', onLoad?: () => void): RevealLoader {
  let calls = 0;
  return async ({ experienceId, manifestRevision, revealRef, recordRevision, signal }) => {
    calls++;
    onLoad?.();
    const f = fault();
    if (f === 'fail' || (f === 'fail-once' && calls === 1)) throw new Error('the record service did not answer');
    const mod = await import('../../../data/experienceV3Fixtures/runtime/theCorrection.reveal.ts');
    if (signal.aborted) throw new Error('aborted');
    const binding = mod.correctionRevealBinding();
    if (revealRef !== binding.revealRef || recordRevision !== binding.recordRevision) throw new Error('unknown record reference');
    if (f === 'missing') return undefined;
    const record = mod.resolveCorrectionReveal(experienceId, manifestRevision);
    if (!record) return undefined;
    const v = validateRevealRecord(record, { experienceId, recordRevision, options, profile: binding.profile });
    if (!v.ok) throw new Error('the record does not match its launch profile');
    // Faults return what a broken service would: markup in the text, or a record of another revision.
    if (f === 'invalid' || (f === 'invalid-once' && calls === 1)) return { ...record, act: `<b>${record.act}</b>` };
    if (f === 'stale') return { ...record, revision: 'gold-0' };
    return record;
  };
}
