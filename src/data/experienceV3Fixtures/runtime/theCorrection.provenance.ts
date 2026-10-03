/**
 * THE CORRECTION — provenance trace: runtime fact → gold fact → source span → approved claim.
 *
 * Reads the private source ledger, but only its PRE-BOUNDARY half: `spans`,
 * `evidenceFacts` and the normalized pre-boundary text. `revealSource`
 * (R01–R03 / RF01–RF03) is never read, so the trace cannot carry the author's
 * act, why or aftermath. This is engineering evidence for review; it is not
 * imported by the public manifest module.
 */

import source from '../spec/the-correction.source.private.json' with { type: 'json' };
import type { PlaybackManifestV3 } from '../../../engine/v3/contracts/manifest.ts';
import { runtimeFactId } from './adaptGoldSpec.ts';

export interface SpanRef {
  id: string;
  /** Half-open NFC code-point offsets into the normalized pre-boundary source. */
  start: number;
  end: number;
  excerpt: string;
}

export interface FactProvenance {
  runtimeFact: string;
  goldFact: string;
  claim: string;
  approval: string;
  disclosure: 'before_boundary';
  spans: SpanRef[];
}

export interface ProvenanceTrace {
  experienceId: string;
  sourceRevision: string;
  sourceSha256: string;
  offsetConvention: string;
  facts: FactProvenance[];
}

/** The pre-boundary ledger only. */
export const CORRECTION_SOURCE_LEDGER = {
  experienceId: source.experienceId,
  sourceRevision: source.sourceRevision,
  sourceSha256: source.sourceSha256,
  offsetConvention: source.offsetConvention,
  normalizedPreBoundary: source.normalizedPreBoundary,
  spans: source.spans.filter(s => s.disclosure === 'before_boundary'),
  evidenceFacts: source.evidenceFacts.filter(f => f.disclosure === 'before_boundary'),
};

/**
 * Trace every fact a manifest exposes. A runtime fact with no approved pre-boundary ledger entry,
 * or a ledger span that does not exist, is reported in `missing` rather than silently traced.
 */
export function traceCorrectionFacts(m: PlaybackManifestV3): { trace: ProvenanceTrace; missing: string[] } {
  const ledger = CORRECTION_SOURCE_LEDGER;
  const missing: string[] = [];
  const facts: FactProvenance[] = [];
  for (const fact of m.facts) {
    const gold = ledger.evidenceFacts.find(f => runtimeFactId(f.id) === fact.id);
    if (!gold) {
      missing.push(fact.id);
      continue;
    }
    const spans = gold.sourceSpanIds.map(id => ledger.spans.find(s => s.id === id));
    if (spans.some(s => !s)) {
      missing.push(fact.id);
      continue;
    }
    facts.push({
      runtimeFact: fact.id,
      goldFact: gold.id,
      claim: gold.claim,
      approval: gold.approval,
      disclosure: 'before_boundary',
      spans: spans.map(s => ({ id: s!.id, start: s!.startCodePoint, end: s!.endCodePoint, excerpt: s!.excerpt })),
    });
  }
  return {
    trace: { experienceId: ledger.experienceId, sourceRevision: ledger.sourceRevision, sourceSha256: ledger.sourceSha256, offsetConvention: ledger.offsetConvention, facts },
    missing,
  };
}
