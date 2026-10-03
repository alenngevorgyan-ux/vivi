/**
 * THE CORRECTION — runtime adaptation of gold-1 (public, pre-boundary only).
 *
 * gold planning envelope ─adaptGoldSpec→ SemanticPlanV3 ─compileFixturePlan→ PlaybackManifestV3 ─→ StoredPostV3
 *
 * Two variants share every fact, act, decision id and the one author record:
 *  - `rich`: the gold four views / three locations, with the reversible hallway break;
 *  - `compressed`: the gold §M control, one meeting location in two frames, break narrated.
 *
 * This module never imports a `*.private.json` file. The reveal lives in
 * `theCorrection.reveal.ts`; source provenance in `theCorrection.provenance.ts`.
 * Story-specific interpretation is DATA below, not code: the adapter and the
 * controller stay generic.
 */

import spec from '../spec/the-correction.semantic.json' with { type: 'json' };
import type { PlaybackManifestV3, StoredPostV3 } from '../../../engine/v3/contracts/manifest.ts';
import { adaptGoldSpec, type AdaptationTrace, type GoldAdaptation, type GoldEnvelope } from './adaptGoldSpec.ts';
import { compileFixturePlan, type GeometryExport } from './compileFixturePlan.ts';
import { placeholderGeometry } from './placeholderGeometry.ts';
import type { SemanticPlanV3 } from '../../../engine/v3/contracts/semantic.ts';

export const CORRECTION_ENVELOPE = spec as unknown as GoldEnvelope;

export type CorrectionVariant = 'rich' | 'compressed';
export const CORRECTION_VARIANTS: readonly CorrectionVariant[] = ['rich', 'compressed'];

/** Every pinned identity this adaptation depends on. Change one, review the evidence that depended on it. */
export const CORRECTION_VERSIONS = {
  experienceId: 'the-correction',
  goldRevision: 'gold-1',
  sourceRevision: 'correction-source-1',
  sourceSha256: 'b7be36746cb8df5a839d3ae199a72e939bd48513f0d869bf33d3aec6abd5edce',
  planningEnvelope: 'vivi-format-proof-1',
  formatProofSha: '028e400fb78d888036a5e184a8060200e63a5a0b',
  foundationSha: 'ae60563c64ac245f94e7e1abc9a8a7089e844055',
  contract: { runtimeManifest: 3, semanticSchema: 3, postSchema: 3, snapshot: 1 },
  /** The integration compiler stand-in (compileFixturePlan) and this adapter binding. */
  compilerVersion: '0.1.0-dev.1',
  stagingApprovalId: 'editorial-staging-correction-1',
  manifest: {
    rich: { revision: 'gold-1', decisionVersion: 'gold-1' },
    // A control is a separate research cell: its first choices are never pooled with the rich version's.
    compressed: { revision: 'gold-1-compressed', decisionVersion: 'gold-1-compressed' },
  },
  /** Both variants resolve this one private record; see theCorrection.reveal.ts. */
  revealRef: 'reveal-the-correction-gold-1',
} as const;

/* ------------------------------------------------------- shared binding --- */

/** Gold ledger span ids per fact (§B). Tests prove this equals the private ledger; nothing here reads it. */
const FACT_SPANS: Record<string, string[]> = {
  F01: ['S01'], F02: ['S02'], F03: ['S03'], F04: ['S04'], F05: ['S05'], F06: ['S06'], F07: ['S07'],
  F08: ['S08'], F09: ['S09'], F10: ['S10'], F11: ['S11'], F12: ['S12'], F13: ['S12'], F14: ['S13'],
};

const SHARED = {
  stateVariables: { break: { portals: ['p_hall', 'p_room'] } },
  // Live speech only. F04 is Mira's sentence recalled from yesterday — gold §D: "not a live voice" — so it is narrated.
  quotes: { F06: 'a_director', F11: 'a_director' },
  gateOverrides: {
    'preparations.prep_seat': {
      gate: { kind: 'beat_delivered', id: 'ev_resume' },
      reason: 'S09 "When the meeting resumed, I could go back to my seat or stand nearer the director." Foundation preparations are not scene-scoped; the resume receipt scopes them to the final meeting phase.',
    },
    'preparations.prep_near': {
      gate: { kind: 'beat_delivered', id: 'ev_resume' },
      reason: 'As prep_seat.',
    },
  },
  factSpans: FACT_SPANS,
  presentationMood: 'public',
} satisfies Partial<GoldAdaptation>;

const ADAPTATIONS: Record<CorrectionVariant, GoldAdaptation> = {
  rich: {
    ...SHARED,
    scenes: [
      { id: 'c_desk', gold: ['c_desk'] },
      { id: 'c_meeting_before', gold: ['c_meeting_before'] },
      { id: 'c_hallway', gold: ['c_hallway'] },
      { id: 'c_meeting_question', gold: ['c_meeting_question'] },
    ],
    // Gold §E/§F: a room visit during the break is c_meeting_before under the break, never a fifth scene.
    // Labels are verbatim S09: "I could return to the room and step into the hallway again during the break."
    excursions: {
      p_hall: { fromScene: 'c_meeting_before', toScene: 'c_hallway', label: 'Step into the hallway again' },
      p_room: { fromScene: 'c_hallway', toScene: 'c_meeting_before', label: 'Return to the room' },
    },
    removedPortals: {},
  },
  compressed: {
    ...SHARED,
    // Gold §M: "One meeting location, two frames": an editorial before-meeting recollection, then the present meeting.
    scenes: [
      { id: 'c_compressed_before', gold: ['c_desk'], location: 'meeting', kind: 'memory', viewpoint: 'remembered', purpose: 'orient', composition: 'dev_placeholder_recollection_frame' },
      { id: 'c_compressed_meeting', gold: ['c_meeting_before', 'c_hallway', 'c_meeting_question'], composition: 'dev_placeholder_meeting_frame' },
    ],
    excursions: {},
    removedPortals: {
      p_hall: 'Gold §M: walkable hallway removed; the break is narrated with the same open-door facts.',
      p_room: 'Gold §M: as p_hall.',
    },
    actorLocations: { a_me: 'meeting' },
  },
};

const GEOMETRY: Record<CorrectionVariant, GeometryExport> = {
  rich: placeholderGeometry({ c_desk: 'desk', c_meeting_before: 'meeting', c_hallway: 'hallway', c_meeting_question: 'meeting' }),
  compressed: placeholderGeometry({ c_compressed_before: 'meeting', c_compressed_meeting: 'meeting' }),
};

/* --------------------------------------------------------------- build --- */

export const correctionAdaptation = (variant: CorrectionVariant): GoldAdaptation => structuredClone(ADAPTATIONS[variant]);

export function correctionSemanticPlan(variant: CorrectionVariant = 'rich'): { plan: SemanticPlanV3; trace: AdaptationTrace } {
  return adaptGoldSpec(CORRECTION_ENVELOPE, ADAPTATIONS[variant]);
}

export function correctionManifest(variant: CorrectionVariant = 'rich', geometry: GeometryExport = GEOMETRY[variant]): PlaybackManifestV3 {
  const { plan } = correctionSemanticPlan(variant);
  return compileFixturePlan(plan, {
    experienceId: CORRECTION_VERSIONS.experienceId,
    ...CORRECTION_VERSIONS.manifest[variant],
    locale: 'en',
    compilerVersion: CORRECTION_VERSIONS.compilerVersion,
    stagingDisclosure: CORRECTION_ENVELOPE.stagingDisclosure,
    geometry,
  });
}

export function correctionPost(variant: CorrectionVariant = 'rich'): StoredPostV3 {
  return {
    postSchemaVersion: 3,
    id: `post-the-correction-${CORRECTION_VERSIONS.manifest[variant].revision}`,
    playback: correctionManifest(variant),
    revealRef: CORRECTION_VERSIONS.revealRef,
  };
}

export const correctionGeometry = (variant: CorrectionVariant): GeometryExport => structuredClone(GEOMETRY[variant]);
