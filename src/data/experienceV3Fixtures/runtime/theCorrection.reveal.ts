/**
 * THE CORRECTION — the private author record, adapted to `RevealRecordV3`.
 *
 * PRIVATE. This is the only runtime module that reads
 * `../spec/the-correction.reveal.private.json`. Nothing public imports it: the
 * manifest, the post, the readable model, the visual hooks and the dev trace
 * are all built without it, and the tests prove its text never reaches them.
 * A host resolves it only after the truth boundary (`load_reveal` effect).
 *
 * Repository separation is a discipline, not secrecy: anyone reading the repo
 * can read this file. A production host must serve the record from a trusted
 * service after the boundary; that is out of scope here.
 */

import privateReveal from '../spec/the-correction.reveal.private.json' with { type: 'json' };
import type { RevealRecordV3 } from '../../../engine/v3/contracts/manifest.ts';
import type { RevealBinding } from '../../../components/experience/v3/hostContracts.ts';
import { CORRECTION_VERSIONS } from './theCorrection.ts';

/** The exact gold record, as authored. Read-only. */
export const CORRECTION_PRIVATE_REVEAL = privateReveal;

export function correctionReveal(): RevealRecordV3 {
  return {
    revealSchemaVersion: 1,
    experienceId: privateReveal.experienceId,
    revision: privateReveal.revision,
    status: 'fictional_editorial',
    act: privateReveal.act,
    why: privateReveal.why,
    aftermath: privateReveal.aftermath,
    withheld: privateReveal.deliberatelyWithheld,
    // The author's act maps onto one option. The mapping is private and is never needed to play.
    authorOption: privateReveal.authorOption,
    authorHandle: privateReveal.authorHandle,
    sourceRefs: ['r01', 'r02', 'r03'],
  };
}

/**
 * Strings that must never appear in anything public before the boundary: the three fields, plus
 * distinctive phrases so a paraphrased or partial copy is caught too. None occurs in the public story.
 */
export const CORRECTION_REVEAL_CANARIES: readonly string[] = [
  privateReveal.act,
  privateReveal.why,
  privateReveal.aftermath,
  'I can explain the revision',
  'My voice shook',
  'not being the presenter',
  'become hers in the board proposal',
  'embarrassed her',
  'stopped inviting me',
  'present the next update',
  'nearly cost it',
];

/** Reveal-only presentation material, released with the record (gold §L). */
export const CORRECTION_REVEAL_PRESENTATION = {
  bridge: 'That is where your version stops. Here is what I did.',
  withheld: privateReveal.deliberatelyWithheld,
  /** Act enters automatically; why and aftermath are reader-paced; never a timer. */
  sequence: [
    { field: 'act', entry: 'automatic' },
    { field: 'why', entry: 'reader' },
    { field: 'aftermath', entry: 'reader' },
  ],
} as const;

/**
 * Host-side resolver for the `load_reveal` effect. Every variant of this experience resolves the
 * same single record: a control never gets a different account.
 */
export function resolveCorrectionReveal(experienceId: string, manifestRevision: string): RevealRecordV3 | undefined {
  if (experienceId !== CORRECTION_VERSIONS.experienceId) return undefined;
  const known = Object.values(CORRECTION_VERSIONS.manifest).some(v => v.revision === manifestRevision);
  return known ? correctionReveal() : undefined;
}

/**
 * The trusted mapping a host passes to ExperienceHost: every variant of this experience resolves the one
 * private record, validated against the gold-1 launch profile (exact status, all three fields, sources and option).
 */
export function correctionRevealBinding(): RevealBinding {
  return {
    revealRef: CORRECTION_VERSIONS.revealRef,
    recordRevision: CORRECTION_VERSIONS.recordRevision,
    profile: { status: 'fictional_editorial', requireFields: ['act', 'why', 'aftermath'], sourceRefs: ['r01', 'r02', 'r03'], authorOption: privateReveal.authorOption },
  };
}
