/**
 * The truth boundary: identical for every act (Design C08). The paint withdraws, the others drop to graphite,
 * the hero stays in its final pose as ink; the Gold boundary line and the persistent fictional label carry the
 * public paper motif. No NPC reaction, no new evidence, no causal time.
 *
 * BOUNDARY receipt after the withdrawal is on screen. The private account is requested by the host only when
 * that receipt AND durable acceptance have both happened (revealGate). While acceptance is not yet durable this
 * says so plainly and offers the retry; there is no extra mandatory wait.
 */

import React from 'react';
import type { ExperienceHost } from './ExperienceHost';
import type { HostStatus } from './hostContracts';
import { useReceipt } from './PresentationReceipts';

interface Props {
  host: ExperienceHost;
  status: HostStatus;
  phase: string;
  instance: string;
  withdrawn: boolean;
  boundaryLine: string;
  disclosure: string;
  motifSrc?: string;
}

export function CorrectionBoundary({ host, status, phase, instance, withdrawn, boundaryLine, disclosure, motifSrc }: Props) {
  useReceipt(host, 'boundaryPresented', phase === 'boundary' && withdrawn, instance);
  const p = status.persistence;
  const saving = status.revealGate === 'waiting_for_durable_acceptance';
  const failed = p.journal === 'failed' && (p.repository === 'failed' || p.repository === 'unconfigured');
  return (
    <section className="v3p-boundary" aria-label="Where your version stops" data-testid="boundary" data-gate={status.revealGate}>
      <p className="v3p-fiction-label">{disclosure}</p>
      {motifSrc && <img className="v3p-motif" src={motifSrc} alt="" data-testid="boundary-motif" />}
      <p className="v3p-boundary-line" data-testid="boundary-line">
        {boundaryLine}
      </p>
      {phase === 'boundary' && !withdrawn && (
        <button type="button" data-testid="boundary-skip" onClick={() => host.skip()}>
          Skip
        </button>
      )}
      {saving && !failed && (
        <p role="status" data-testid="boundary-saving">
          Keeping your act on this device…
        </p>
      )}
      {failed && (
        <p role="alert" data-testid="boundary-save-failed">
          Your act is accepted but could not be saved yet, so the author’s account stays closed.{' '}
          <button type="button" data-testid="boundary-save-retry" onClick={() => host.retryPersistence()}>
            Save again
          </button>
        </p>
      )}
    </section>
  );
}
