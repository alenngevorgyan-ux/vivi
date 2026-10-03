/**
 * Decision projection: ONE control group for the primary decision, projected from the derived opportunities.
 *
 * The options, their order and their availability come only from the readable model (queries.ts →
 * opportunityBlock); nothing here keeps an option list. Copy comes from the story's approved binding.
 * Selecting (REQUEST_INTENT) and accepting (CONFIRM) are two separate controls with two separate activations;
 * the reducer refuses a confirm spent by the selecting gesture. Keyboard, pointer, touch and readable mode all
 * press these same buttons.
 *
 * Layout only differs by where the one group sits: `anchored` (landscape stage: each label beside the anchor
 * Design assigns — table centre, director, the hero's own preparation) or `stacked` (portrait thumb zone,
 * readable mode). Never two tabbable copies at once.
 */

import React from 'react';
import type { ReadableModel } from '../../../engine/v3/readable';
import { readableEvents } from '../../../engine/v3/readable';
import type { ExperienceEvent, StepResult } from '../../../engine/v3/ExperienceController';
import type { OverlayLayout } from './SceneViewportV3';
import type { StagingV3 } from './staging';
import { ScopeDialog } from './FocusCoordinator';

export interface DecisionCopy {
  intention(option: string): string;
  confirmation(option: string): { copy: string; confirm: string; cancel: string };
}

interface Props {
  readable: ReadableModel;
  reserved?: string;
  copy: DecisionCopy;
  dispatch: (e: ExperienceEvent) => StepResult;
  activation: (e: React.SyntheticEvent) => string;
  mode: 'anchored' | 'stacked';
  overlay?: OverlayLayout;
  staging?: StagingV3;
  heading?: string;
}

/** Design's anchor for an option: its act's first fixed attention target, else the hero. */
function anchorOf(option: string, l: OverlayLayout, staging?: StagingV3) {
  const t = staging?.enactments[option]?.attention.find(a => a.kind === 'point');
  if (t && t.kind === 'point') return l.project(t.at[0], t.at[1], t.at[2]);
  return l.hero;
}

export function DecisionProjectionV3({ readable, reserved, copy, dispatch, activation, mode, overlay, staging, heading }: Props) {
  const options = readable.actions.filter(a => a.available || a.id === reserved);
  if (!options.length) return null;
  const button = (id: string, style?: React.CSSProperties) => (
    <button
      key={id}
      type="button"
      className={`v3p-option${reserved === id ? ' is-confirming' : ''}`}
      style={style}
      data-testid={`decision-option-${id}`}
      aria-pressed={reserved === id}
      aria-describedby="v3p-decision-hint"
      onClick={e => dispatch(readableEvents.chooseAct(id, activation(e)))}
    >
      {copy.intention(id)}
    </button>
  );
  if (mode === 'anchored' && overlay) {
    const W = Math.min(300, overlay.box.w * 0.3);
    const H = 72; // two wrapped lines at the base size; the pass below keeps labels apart
    // Each label starts beside its anchor; overlapping labels are pushed apart vertically (order is fixed and
    // neutral: manifest order), then kept inside the stage. Equal size, equal style.
    const placed: Array<{ id: string; left: number; top: number }> = [];
    for (const o of options) {
      const a = anchorOf(o.id, overlay, staging) ?? { x: overlay.box.w / 2, y: overlay.box.h / 2 };
      const left = Math.min(Math.max(8, a.x - W / 2), overlay.box.w - W - 8);
      let top = Math.min(Math.max(8, a.y + 10), overlay.box.h - H - 8);
      for (let guard = 0; guard < 6; guard++) {
        const hit = placed.find(q => Math.abs(q.left - left) < W && Math.abs(q.top - top) < H);
        if (!hit) break;
        top = hit.top + H + 6 <= overlay.box.h - H - 8 ? hit.top + H + 6 : Math.max(8, hit.top - H - 6);
      }
      placed.push({ id: o.id, left, top });
    }
    return (
      <div role="group" aria-label={heading ?? 'Your act'} className="v3p-decision is-anchored" data-testid="decision-group">
        <p id="v3p-decision-hint" className="v3p-sr-only">Choosing opens a separate confirmation. Nothing happens until you confirm.</p>
        {placed.map(q => button(q.id, { position: 'absolute', left: q.left, top: q.top, width: W }))}
      </div>
    );
  }
  return (
    <div role="group" aria-label={heading ?? 'Your act'} className="v3p-decision is-stacked" data-testid="decision-group">
      <p id="v3p-decision-hint" className="v3p-hint">Choosing opens a separate confirmation. Nothing happens until you confirm.</p>
      {options.map(o => button(o.id))}
    </div>
  );
}

/** The separate confirmation step: Gold confirmation copy, a distinct accept control, and a way back. */
export function ConfirmDialogV3({ option, copy, dispatch, activation }: { option?: string; copy: DecisionCopy; dispatch: (e: ExperienceEvent) => StepResult; activation: (e: React.SyntheticEvent) => string }) {
  const c = option ? copy.confirmation(option) : undefined;
  return (
    <ScopeDialog open={!!option} modal label="Confirm your act" focusKey={option} testId="confirm-dialog" className="v3p-dialog v3p-confirm">
      {option && c && (
        <>
          <h3 tabIndex={-1} data-v3-initial-focus="" data-testid="confirm-heading">
            {copy.intention(option)}
          </h3>
          <p data-testid="confirm-copy">{c.copy}</p>
          <div className="v3p-confirm-actions">
            <button type="button" className="v3p-primary" data-testid="confirm-button" onClick={e => dispatch(readableEvents.confirmAct(option, activation(e)))}>
              {c.confirm}
            </button>
            <button type="button" data-testid="cancel-button" onClick={() => dispatch(readableEvents.cancel())}>
              {c.cancel}
            </button>
          </div>
        </>
      )}
    </ScopeDialog>
  );
}
