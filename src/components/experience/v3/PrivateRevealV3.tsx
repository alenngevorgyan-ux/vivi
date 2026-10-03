/**
 * The private author account, rendered only from a record ExperienceHost validated after the boundary
 * (`host.revealRecord()`, defined only in revealed/ended). Every option reaches this same record; nothing here
 * reads the player's choice. A missing, invalid or stale record renders no account: a visible failure and retry.
 *
 * Order (Gold §L): heading (focused once) · the act, automatically · why, on the reader's Continue · aftermath on
 * the next Continue, with the withheld note as an honest limit. "Skip the rest" is recorded as skipped, not read.
 * Plain text only (React escapes it); the fictional label stays visible throughout.
 */

import React, { useState } from 'react';
import type { RevealRecordV3 } from '../../../engine/v3/contracts/manifest';
import type { HostStatus } from './hostContracts';
import { RevealHeading } from './FocusCoordinator';

interface Props {
  phase: string;
  status: HostStatus;
  record?: RevealRecordV3;
  bridge: string;
  disclosure: string;
  motifSrc?: string;
  onRetry: () => void;
  onFinish: () => void;
  onDisclosure?: (e: 'why' | 'aftermath' | 'skipped') => void;
}

export function PrivateRevealV3({ phase, status, record, bridge, disclosure, motifSrc, onRetry, onFinish, onDisclosure }: Props) {
  const [shown, setShown] = useState(1);
  const [skipped, setSkipped] = useState(false);
  const failed = status.reveal.state === 'failed';
  const usable = (phase === 'revealed' || phase === 'ended') && !!record;

  if (!usable)
    return (
      <section className="v3p-reveal is-loading" aria-label="The author’s account" data-testid="reveal-pending">
        <p className="v3p-fiction-label">{disclosure}</p>
        {motifSrc && <img className="v3p-motif" src={motifSrc} alt="" />}
        {failed ? (
          <p role="alert" data-testid="reveal-failed">
            The author’s account could not be loaded. Your act is kept and will not be asked again.{' '}
            <button type="button" data-testid="reveal-retry" onClick={onRetry}>
              Try again
            </button>
          </p>
        ) : (
          <p role="status" data-testid="reveal-loading">
            Opening the author’s account…
          </p>
        )}
      </section>
    );

  const done = shown >= 3 || skipped;
  return (
    <article className="v3p-reveal" aria-label="The author’s account" data-testid="reveal">
      <p className="v3p-fiction-label" data-testid="reveal-fiction-label">
        {disclosure}
      </p>
      <RevealHeading>{bridge}</RevealHeading>
      <p className="v3p-author">Fictional editorial author · {record.authorHandle}</p>
      <section aria-label="What I did">
        <h3>What I did</h3>
        <p className="v3p-account" data-testid="reveal-act">
          {record.act}
        </p>
      </section>
      {shown >= 2 && record.why && (
        <section aria-label="Why">
          <h3>Why</h3>
          <p className="v3p-account" data-testid="reveal-why">
            {record.why}
          </p>
        </section>
      )}
      {shown >= 3 && record.aftermath && (
        <section aria-label="Afterwards">
          <h3>Afterwards</h3>
          <p className="v3p-account" data-testid="reveal-aftermath">
            {record.aftermath}
          </p>
          {record.withheld && (
            <p className="v3p-withheld" data-testid="reveal-withheld">
              <strong>Not disclosed: </strong>
              {record.withheld}
            </p>
          )}
        </section>
      )}
      {!done && (
        <div className="v3p-reveal-actions">
          <button
            type="button"
            className="v3p-primary"
            data-testid="reveal-continue"
            onClick={() => {
              setShown(n => n + 1);
              onDisclosure?.(shown === 1 ? 'why' : 'aftermath');
            }}
          >
            Continue
          </button>
          <button
            type="button"
            data-testid="reveal-skip"
            onClick={() => {
              setSkipped(true);
              onDisclosure?.('skipped');
            }}
          >
            Skip the rest of the account
          </button>
        </div>
      )}
      {done && phase === 'revealed' && (
        <div className="v3p-reveal-actions">
          <button type="button" className="v3p-primary" data-testid="reveal-finish" onClick={onFinish}>
            Finish this fictional story
          </button>
        </div>
      )}
      {phase === 'ended' && (
        <p role="status" data-testid="story-ended">
          This fictional test story has ended.
        </p>
      )}
    </article>
  );
}
