/**
 * The Phase 1 player shell.
 *
 * This is deliberately NOT the final V3 player: no art, no camera, no
 * characters. It is the smallest real DOM that exercises the substrate (one
 * input owner, one focus owner, the pure controller, the readable path) so the
 * ownership rules can be proven with real keyboard events, and so the later
 * viewport, action sheet and reveal can replace the placeholders without
 * touching input, focus or causal state.
 *
 * It decides nothing: every button dispatches a controller event, and every
 * label comes from the readable projection.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlaybackManifestV3 } from '../../../engine/v3/contracts/manifest';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state';
import type { EntityRef } from '../../../engine/v3/contracts/semantic';
import { readableEvents, type ReadableModel } from '../../../engine/v3/readable';
import { targetActions, targetExists } from '../../../engine/v3/queries';
import type { ExperienceEvent, StepResult } from '../../../engine/v3/ExperienceController';
import { InputManager, type InputIntent } from '../../../engine/input/InputManager';
import { FocusCoordinatorProvider, RevealHeading, ScopeDialog, WorldEntryButton, WorldSurface, useFocusCoordinator } from './FocusCoordinator';
import { useExperience } from './useExperience';
import type { HostConfig } from './hostContracts';
import './v3foundation.css';

export interface PlayerApi {
  dispatch: (e: ExperienceEvent) => StepResult;
  getState: () => RuntimeSnapshot;
  manager: InputManager;
  host: import('./ExperienceHost').ExperienceHost;
}

export interface V3FoundationPlayerProps {
  manifest: PlaybackManifestV3;
  /** The host contracts: preparation, journal, repository, private-record loader and binding. Stable per revision. */
  host: HostConfig;
  /** A stored snapshot to resume (validated; an invalid one starts fresh). */
  restore?: unknown;
  attemptId?: string;
  /** Observe every semantic intent the InputManager emits (diagnostics and tests). */
  onIntent?: (intent: InputIntent) => void;
  onEvent?: (event: ExperienceEvent, result: StepResult) => void;
  onReady?: (api: PlayerApi) => void;
}

export function V3FoundationPlayer(props: V3FoundationPlayerProps) {
  const intentRef = useRef<(i: InputIntent) => void>(() => undefined);
  const [manager] = useState(() => new InputManager({ onIntent: i => intentRef.current(i) }));
  // A layout effect: the owner listens before any passive-effect listener, so ownership loss is processed first.
  useLayoutEffect(() => {
    manager.attach();
    return () => manager.dispose(); // route change: every listener and every held key goes with it
  }, [manager]);
  return (
    <FocusCoordinatorProvider manager={manager}>
      <PlayerBody {...props} manager={manager} intentRef={intentRef} />
    </FocusCoordinatorProvider>
  );
}

const refKey = (r: EntityRef) => (r.kind === 'self' ? 'self' : `${r.kind}-${r.id}`);

function PlayerBody({ manifest, manager, intentRef, host: hostConfig, restore, attemptId, onIntent, onEvent, onReady }: V3FoundationPlayerProps & { manager: InputManager; intentRef: React.MutableRefObject<(i: InputIntent) => void> }) {
  const focus = useFocusCoordinator();
  const { host, state, status, dispatch, readable, getState } = useExperience(manifest, { manager, host: hostConfig, restore, attemptId, onEvent });
  const activation = (e: React.SyntheticEvent) => manager.activationIdFor(e.nativeEvent);

  /* semantic intents → controller events. The only place a device meets the story. */
  intentRef.current = (i: InputIntent) => {
    onIntent?.(i);
    switch (i.type) {
      case 'activate':
        // Enter in the world opens the contextual target or the action list. A pointer tap on the stage is the
        // future floor/target hit-test (inverse camera); until a viewport exists it only enters the scene controls.
        if (i.source === 'key') dispatch({ type: 'ACTIVATE_CONTEXT', activationId: i.activationId });
        break;
      case 'cancel': {
        const r = dispatch({ type: 'CANCEL' });
        if (r.rejected && i.scope === 'world') focus.releaseWorld();
        break;
      }
      case 'movement_blocked':
        focus.announce('Movement is not available right now.');
        break;
      case 'move':
        break; // locomotion belongs to the future NavigationService
    }
  };

  useEffect(() => {
    onReady?.({ dispatch, getState, manager, host });
  }, [dispatch, getState, manager, host, onReady]);

  /* lifecycle: the host prepares the scene and sends LOADED; the shell enters, and hands focus back after a scene swap (never on the first entry) */
  const firstEntry = useRef(true);
  useEffect(() => {
    if (state.phase === 'entering') {
      if (firstEntry.current) firstEntry.current = false;
      else focus.handoffToWorld();
      dispatch({ type: 'ENTERED' });
    }
  }, [state.phase, dispatch, focus]);

  const confirming = state.phase === 'confirming' ? readable.actions.find(a => a.id === state.reservation?.option) : undefined;
  const target = state.selectedTarget;
  const targets = uniqueTargets(manifest, state, readable);

  return (
    <section className="v3-player" aria-label="Scene">
      <header className="v3-header">
        <h2 data-testid="scene-id">{readable.scene.id}</h2>
        <p data-testid="phase">{state.phase}</p>
        <p data-testid="location">{readable.scene.location}</p>
      </header>

      <WorldEntryButton>Enter scene controls</WorldEntryButton>
      <WorldSurface label="Scene controls. Arrow keys or WASD move. Enter opens actions. Tab leaves." describedBy="v3-keys" className="v3-surface">
        <p className="v3-stage" aria-hidden="true">
          stage · {readable.scene.location}
        </p>
        {target && <p data-testid="selected-target">selected: {refKey(target)}</p>}
      </WorldSurface>
      <p id="v3-keys" className="v3-hint">
        Click or tap the stage, or press the button above, to use the keyboard. Escape leaves it; Tab moves on.
      </p>

      <div className="v3-targets" role="group" aria-label="Things in this scene">
        {targets.map(t => (
          <button key={refKey(t.ref)} type="button" data-testid={`target-${refKey(t.ref)}`} aria-pressed={!!target && refKey(target) === refKey(t.ref)} onClick={() => dispatch({ type: 'SELECT_TARGET', target: t.ref })}>
            {t.label}
          </button>
        ))}
      </div>

      <ReadableList readable={readable} dispatch={dispatch} activation={activation} />

      <ObservationPanel manifest={manifest} state={state} dispatch={dispatch} />
      <ActionSheet manifest={manifest} state={state} readable={readable} confirming={confirming} dispatch={dispatch} activation={activation} />
      <SettingsModal state={state} dispatch={dispatch} />

      {state.phase === 'revealed' || state.phase === 'ended' ? (
        <section className="v3-reveal" aria-label="Author account">
          <RevealHeading>Here is where your version stops.</RevealHeading>
          <p data-testid="reveal-note">The author's account loads from a separate record, after the boundary.</p>
        </section>
      ) : null}
      {state.phase === 'loading' && status.entry === 'failed' && (
        <p role="alert" data-testid="entry-failed">
          The scene did not load. <button type="button" data-testid="entry-retry" onClick={() => host.retryEntry()}>Try again</button>
        </p>
      )}
      {state.phase === 'playing' && status.transition.state === 'failed' && (
        <p role="alert" data-testid="transition-failed">
          That place did not load. You are still here.
        </p>
      )}
      {state.decision && (status.persistence.error || status.persistence.repository === 'unconfigured' || status.persistence.journal === 'unconfigured') && (
        <p role="alert" data-testid="persistence-failed">
          Your act is kept on this device but is not saved yet. <button type="button" data-testid="persistence-retry" onClick={() => host.retryPersistence()}>Save again</button>
        </p>
      )}
      {state.phase === 'reveal_loading' && status.reveal.state === 'failed' && (
        <p role="alert" data-testid="reveal-failed">
          The account did not load. Your act is kept. <button type="button" data-testid="reveal-retry" onClick={() => host.retryReveal()}>Try again</button>
        </p>
      )}
      <p className="v3-hint" data-testid="host-status" hidden>
        {`entry:${status.entry} gate:${status.revealGate} journal:${status.persistence.journal} repo:${status.persistence.repository} reveal:${status.reveal.state}`}
      </p>
    </section>
  );
}

function uniqueTargets(m: PlaybackManifestV3, s: RuntimeSnapshot, r: ReadableModel): Array<{ ref: EntityRef; label: string }> {
  const out = new Map<string, { ref: EntityRef; label: string }>();
  const add = (ref: EntityRef, label: string) => {
    if (targetExists(m, ref) && !out.has(refKey(ref))) out.set(refKey(ref), { ref, label });
  };
  for (const o of r.observations) if (o.available) add(o.target, o.label);
  for (const p of r.preparations) if (p.available) add(p.target, p.label);
  for (const a of m.opportunities) if (r.actions.some(x => x.id === a.id && x.available)) add(a.target, a.target.kind === 'self' ? 'Yourself' : a.label);
  return [...out.values()];
}

/** The action-list alternative: everything a pointer could do, reachable with Tab and Enter alone. */
function ReadableList({ readable, dispatch, activation }: { readable: ReadableModel; dispatch: (e: ExperienceEvent) => StepResult; activation: (e: React.SyntheticEvent) => string }) {
  return (
    <section className="v3-readable" aria-label="What you can do">
      <h3>What you can do</h3>
      <ul>
        {readable.canAdvance && (
          <li>
            <button type="button" data-testid="readable-advance" onClick={e => dispatch(readableEvents.advance(activation(e)))}>
              Continue
            </button>
          </li>
        )}
        {readable.observations.map(o => (
          <li key={o.id}>
            <button type="button" disabled={!o.available} data-testid={`readable-observe-${o.id}`} onClick={e => dispatch(readableEvents.observe(o.id, activation(e)))}>
              {o.label}
              {o.seen ? ' (seen)' : ''}
            </button>
          </li>
        ))}
        {readable.preparations.map(p => (
          <li key={p.id}>
            <button type="button" disabled={!p.available && !p.applied} data-testid={`readable-prepare-${p.id}`} aria-pressed={p.applied} onClick={e => dispatch(p.applied ? readableEvents.undoPreparation(p.id, activation(e)) : readableEvents.prepare(p.id, activation(e)))}>
              {p.label}
            </button>
          </li>
        ))}
        {readable.portals.map(p => (
          <li key={p.id}>
            <button type="button" disabled={!p.available} data-testid={`readable-travel-${p.id}`} onClick={e => dispatch(readableEvents.travel(p.id, activation(e)))}>
              {p.label}
            </button>
          </li>
        ))}
        {readable.actions.map(a => (
          <li key={a.id}>
            <button type="button" disabled={!a.available} data-testid={`readable-act-${a.id}`} onClick={e => dispatch(readableEvents.chooseAct(a.id, activation(e)))}>
              {a.label}
            </button>
          </li>
        ))}
      </ul>
      <h3>What you know</h3>
      <ul data-testid="facts">
        {readable.facts.map(f => (
          <li key={f.id}>{f.text}</li>
        ))}
      </ul>
      <p data-testid="decision-status">{readable.decision.status}</p>
    </section>
  );
}

function ObservationPanel({ manifest, state, dispatch }: { manifest: PlaybackManifestV3; state: RuntimeSnapshot; dispatch: (e: ExperienceEvent) => StepResult }) {
  const obs = manifest.observations.find(o => o.id === state.openObservation);
  const facts = obs ? obs.facts.map(id => manifest.facts.find(f => f.id === id)).filter(Boolean) : [];
  return (
    <ScopeDialog open={!!obs} modal={false} label={obs?.label ?? 'Observation'} testId="observation-panel" className="v3-dialog v3-panel">
      <h3 tabIndex={-1} data-v3-initial-focus="">
        {obs?.label}
      </h3>
      {facts.map(f => (
        <p key={f!.id}>{f!.text}</p>
      ))}
      <button type="button" data-testid="observation-close" onClick={() => dispatch({ type: 'CLOSE_OBSERVATION' })}>
        Close
      </button>
    </ScopeDialog>
  );
}

/** One surface for the contextual list and for the pending act: a semantically modal choice. */
function ActionSheet({ manifest, state, readable, confirming, dispatch, activation }: { manifest: PlaybackManifestV3; state: RuntimeSnapshot; readable: ReadableModel; confirming?: ReadableModel['actions'][number]; dispatch: (e: ExperienceEvent) => StepResult; activation: (e: React.SyntheticEvent) => string }) {
  const open = !!state.sheet || state.phase === 'confirming';
  const t = state.sheet?.kind === 'target' && state.sheet.target ? targetActions(manifest, state, state.sheet.target) : undefined;
  const ids = (xs: Array<{ id: string }> | undefined) => new Set((xs ?? []).map(x => x.id));
  const obs = ids(t?.observations);
  const preps = ids(t?.preparations);
  const portals = ids(t?.portals);
  const acts = ids(t?.opportunities);
  const showing = <T extends { id: string }>(x: T, set: Set<string>) => !t || set.has(x.id);

  return (
    <ScopeDialog open={open} modal label={confirming ? 'Confirm your act' : 'Actions'} focusKey={`${state.phase}:${state.sheet?.kind}`} testId="sheet" className="v3-dialog v3-sheet">
      {confirming ? (
        <>
          <h3 tabIndex={-1} data-v3-initial-focus="" data-testid="confirm-heading">
            {confirming.label}
          </h3>
          <p>{confirming.motive}</p>
          <button type="button" data-testid="confirm-button" onClick={e => dispatch(readableEvents.confirmAct(confirming.id, activation(e)))}>
            Do this
          </button>
          <button type="button" data-testid="cancel-button" onClick={() => dispatch({ type: 'CANCEL' })}>
            Not yet
          </button>
        </>
      ) : (
        <>
          <h3 tabIndex={-1}>Actions</h3>
          <ul>
            {readable.observations.filter(o => o.available && showing(o, obs)).map(o => (
              <li key={o.id}>
                <button type="button" data-testid={`sheet-observe-${o.id}`} onClick={e => dispatch(readableEvents.observe(o.id, activation(e)))}>
                  {o.label}
                </button>
              </li>
            ))}
            {readable.preparations.filter(p => p.available && !p.applied && showing(p, preps)).map(p => (
              <li key={p.id}>
                <button type="button" data-testid={`sheet-prepare-${p.id}`} onClick={e => dispatch(readableEvents.prepare(p.id, activation(e)))}>
                  {p.label}
                </button>
              </li>
            ))}
            {readable.portals.filter(p => p.available && showing(p, portals)).map(p => (
              <li key={p.id}>
                <button type="button" data-testid={`sheet-travel-${p.id}`} onClick={e => dispatch(readableEvents.travel(p.id, activation(e)))}>
                  {p.label}
                </button>
              </li>
            ))}
            {readable.actions.filter(a => a.available && showing(a, acts)).map(a => (
              <li key={a.id}>
                <button type="button" data-testid={`sheet-act-${a.id}`} onClick={e => dispatch(readableEvents.chooseAct(a.id, activation(e)))}>
                  {a.label}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" data-testid="sheet-close" onClick={() => dispatch({ type: 'CLOSE_SHEET' })}>
            Close
          </button>
        </>
      )}
    </ScopeDialog>
  );
}

/** A real modal (settings/pause): contains Tab, inerts the background, and hosts a text field so typing can be proven. */
function SettingsModal({ state, dispatch }: { state: RuntimeSnapshot; dispatch: (e: ExperienceEvent) => StepResult }) {
  return (
    <ScopeDialog open={!!state.modal} modal label="Settings" testId="settings-modal" className="v3-dialog v3-modal">
      <h3 tabIndex={-1}>Settings</h3>
      <label>
        Your note
        <input data-testid="modal-input" type="text" />
      </label>
      <button type="button" data-testid="modal-close" onClick={() => dispatch({ type: 'CLOSE_MODAL' })}>
        Close
      </button>
    </ScopeDialog>
  );
}
