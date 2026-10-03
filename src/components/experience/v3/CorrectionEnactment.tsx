/**
 * The accepted act, presented: the complete intention caption, the hero's own act (drawn by the viewport), and
 * the held trace. No NPC responds and nothing is said that the story does not supply: the caption is the
 * approved intention label, never a quotation.
 *
 * Receipts (guarded, one each, after paint):
 *  - ENACTED when the viewport reports the stop pose on screen AND the caption is rendered;
 *  - HOLD_DONE after the held trace (0.9 s of visible presentation time; reduced motion keeps the still and the
 *    same receipt). Skip installs the final stop and caption first and reaches the same boundary.
 * Acceptance is already immutable when this mounts; failure to save cannot restart it.
 */

import React, { useState } from 'react';
import type { ExperienceHost } from './ExperienceHost';
import { usePresentationTimer, useReceipt } from './PresentationReceipts';

export const HOLD_MS = 900;

interface Props {
  host: ExperienceHost;
  phase: string;
  instance: string;
  caption: string;
  /** The viewport (or the readable mode, which has no walk) has the stop pose on screen. */
  stopped: boolean;
  reducedMotion: boolean;
}

export function CorrectionEnactment({ host, phase, instance, caption, stopped, reducedMotion }: Props) {
  const [heldFor, setHeldFor] = useState('');
  useReceipt(host, 'enacted', phase === 'enacting' && stopped, instance);
  usePresentationTimer(phase === 'holding', HOLD_MS, () => setHeldFor(instance), `${instance}:hold`);
  useReceipt(host, 'held', phase === 'holding' && heldFor === instance, instance);
  return (
    <section className="v3p-enactment" aria-label="Your act" data-testid="enactment" data-phase={phase} data-still={reducedMotion || undefined}>
      <p className="v3p-caption" data-testid="enactment-caption">
        {caption}
      </p>
      <p className="v3p-hint">Your version ends here. No one’s response is shown.</p>
      <button type="button" data-testid="skip-button" onClick={() => host.skip()}>
        Skip to the author’s account
      </button>
    </section>
  );
}
