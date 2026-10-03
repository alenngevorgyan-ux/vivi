/**
 * ExperiencePlayerV3 — the visual V3 player shell.
 *
 * One InputManager (keys, pointer, touch), one FocusCoordinator (focus), one ExperienceHost through
 * useExperience (the only state machine: the pure reducer's snapshot), one readable projection. Every control —
 * on the stage, in the story panel, in readable mode — dispatches the same controller events, so pointer,
 * keyboard, touch and readable paths cannot disagree. Host operational status (preparing, saving, failed) is
 * shown from HostStatus; it is never a second story machine.
 *
 * The renderer (SceneViewportV3) owns presentation only. Receipts (ENACTED → HOLD_DONE → BOUNDARY) are sent
 * through the host's guarded methods after the corresponding state is on screen. The private account is shown
 * only from the host's validated record after the boundary.
 *
 * Story-specific data arrives as props (manifest, staging, geometry, copy); nothing here names a story.
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PlaybackManifestV3 } from '../../../engine/v3/contracts/manifest';
import type { RuntimeGeometryV3 } from '../../../engine/v3/contracts/geometry';
import type { RuntimeSnapshot } from '../../../engine/v3/contracts/state';
import type { EntityRef, ScenePlan } from '../../../engine/v3/contracts/semantic';
import { readableEvents, type ReadableModel } from '../../../engine/v3/readable';
import { targetActions } from '../../../engine/v3/queries';
import type { ExperienceEvent, StepResult } from '../../../engine/v3/ExperienceController';
import { InputManager, type InputIntent } from '../../../engine/input/InputManager';
import { FocusCoordinatorProvider, ScopeDialog, WorldEntryButton, WorldSurface, useFocusCoordinator } from './FocusCoordinator';
import { useExperience } from './useExperience';
import type { HostConfig } from './hostContracts';
import type { ExperienceHost } from './ExperienceHost';
import { SceneViewportV3, type OverlayLayout, type ViewportHandle } from './SceneViewportV3';
import { ConfirmDialogV3, DecisionProjectionV3, type DecisionCopy } from './DecisionProjectionV3';
import { CorrectionEnactment } from './CorrectionEnactment';
import { CorrectionBoundary } from './CorrectionBoundary';
import { PrivateRevealV3 } from './PrivateRevealV3';
import type { AssetCache } from './AssetPreloader';
import type { Orientation, StagingV3 } from './staging';
import { afterPaint } from './PresentationReceipts';
import './experiencePlayerV3.css';

export interface PlayerCopy extends DecisionCopy {
  title: string;
  hook: string;
  disclosure: string;
  displayTitle: string;
  boundaryLine: string;
  /** Readable equivalents of observations (Gold). */
  observations: Record<string, string>;
  /** One-sentence description of what the stage shows, for assistive technology. */
  describeScene(sceneId: string): string;
  /** Scene-specific observation insert (a visual of what is observed); text stays DOM. */
  insert?(observationId: string): React.ReactNode;
}

export interface PlayerApi {
  dispatch: (e: ExperienceEvent) => StepResult;
  getState: () => RuntimeSnapshot;
  manager: InputManager;
  host: ExperienceHost;
}

export interface ExperiencePlayerV3Props {
  manifest: PlaybackManifestV3;
  host: HostConfig;
  staging: StagingV3;
  geometry: RuntimeGeometryV3;
  assets: AssetCache;
  copy: PlayerCopy;
  /** `readable`: the approved readable fallback (no pictures); the same story, controls and receipts. */
  assetMode: 'full' | 'readable';
  onAssetMode: (mode: 'full' | 'readable') => void;
  restore?: unknown;
  attemptId?: string;
  onIntent?: (i: InputIntent) => void;
  onEvent?: (e: ExperienceEvent, r: StepResult) => void;
  onReady?: (api: PlayerApi) => void;
  onDisclosure?: (e: 'why' | 'aftermath' | 'skipped') => void;
  /** Where per-viewer display preferences live (optional; memory only when absent). */
  prefs?: PreferenceStore;
}

export function ExperiencePlayerV3(props: ExperiencePlayerV3Props) {
  const intentRef = useRef<(i: InputIntent) => void>(() => undefined);
  const [manager] = useState(() => new InputManager({ onIntent: i => intentRef.current(i) }));
  useLayoutEffect(() => {
    manager.attach();
    return () => manager.dispose();
  }, [manager]);
  return (
    <FocusCoordinatorProvider manager={manager}>
      <PlayerBody {...props} manager={manager} intentRef={intentRef} />
    </FocusCoordinatorProvider>
  );
}

/* ---------------------------------------------------------- preferences --- */

/** Per-viewer display preferences (readable mode, reduced motion). The host injects storage; the runtime keeps none. */
export interface PreferenceStore {
  read(key: string): boolean | undefined;
  write(key: string, value: boolean): void;
}
const MEMORY_PREFS: PreferenceStore = { read: () => undefined, write: () => undefined };

function useOrientation(): Orientation {
  const get = (): Orientation => (typeof window === 'undefined' ? 'landscape' : window.innerWidth < 760 || window.innerWidth < window.innerHeight * 0.95 ? 'portrait' : 'landscape');
  const [o, setO] = useState<Orientation>(get);
  useEffect(() => {
    const on = () => setO(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return o;
}

function useReducedMotion(prefs: PreferenceStore): [boolean, (v: boolean) => void] {
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : undefined;
  const [system, setSystem] = useState(!!mq?.matches);
  const [user, setUser] = useState<boolean | undefined>(() => prefs.read('reducedMotion'));
  useEffect(() => {
    if (!mq) return;
    const on = () => setSystem(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [mq]);
  return [user ?? system, v => (setUser(v), prefs.write('reducedMotion', v))];
}

/* -------------------------------------------------------------- helpers --- */

const refKey = (r: EntityRef) => (r.kind === 'self' ? 'self' : `${r.kind}-${r.id}`);

/** The facts a beat delivers, in event order (each once). */
function beatFacts(m: PlaybackManifestV3, plan: ScenePlan, beatId: string | undefined) {
  const beat = plan.beats.find(b => b.id === beatId);
  if (!beat) return [];
  const ids: string[] = [];
  for (const e of beat.events) {
    const fs = e.kind === 'deliver' || e.kind === 'transfer' ? e.facts : e.kind === 'quote' || e.kind === 'device_cue' || e.kind === 'portal_state' ? [e.fact] : [];
    for (const f of fs) if (!ids.includes(f)) ids.push(f);
  }
  return ids.map(id => m.facts.find(f => f.id === id)!).filter(Boolean);
}

/** Render a fact verbatim; a quoted span (curly quotes, as authored) is marked as speech without changing a word. */
function FactText({ text }: { text: string }) {
  const parts = text.split(/(“[^”]+”)/);
  return <>{parts.map((p, i) => (p.startsWith('“') ? <span key={i} className="v3p-quote">{p}</span> : <React.Fragment key={i}>{p}</React.Fragment>))}</>;
}

/* ----------------------------------------------------------------- body --- */

function PlayerBody(props: ExperiencePlayerV3Props & { manager: InputManager; intentRef: React.MutableRefObject<(i: InputIntent) => void> }) {
  const { manifest: m, staging, geometry, assets, copy, assetMode, onAssetMode, manager, intentRef } = props;
  const focus = useFocusCoordinator();
  const { host, state: s, status, dispatch, readable, getState } = useExperience(m, { manager, host: props.host, restore: props.restore, attemptId: props.attemptId, onEvent: props.onEvent });
  const activation = useCallback((e: React.SyntheticEvent) => manager.activationIdFor(e.nativeEvent), [manager]);
  const orientation = useOrientation();
  const prefs = props.prefs ?? MEMORY_PREFS;
  const [reducedMotion, setReducedMotion] = useReducedMotion(prefs);
  const [readableMode, setReadableMode] = useState(() => prefs.read('readable') ?? false);
  const [contextOpen, setContextOpen] = useState(false);
  const [stoppedFor, setStoppedFor] = useState('');
  const [withdrawnFor, setWithdrawnFor] = useState('');
  const [motif, setMotif] = useState<string | undefined>(() => assets.url(staging.props.authorPage));
  const viewport = useRef<ViewportHandle>(null);
  const lastPortal = useRef<string | undefined>(undefined);

  const visual = !readableMode && assetMode === 'full';
  const plan = m.scenePlans.find(p => p.id === s.scene)!;
  const instance = s.decision ? `${s.attemptId}:${s.decision.option}` : '';
  const act = s.decision ? { option: s.decision.option, ...staging.enactments[s.decision.option] } : undefined;

  useEffect(() => {
    props.onReady?.({ dispatch, getState, manager, host });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, getState, manager, host]);

  /* lifecycle: the host prepares and sends LOADED; the shell enters and hands focus back after a swap */
  const firstEntry = useRef(true);
  useEffect(() => {
    if (s.phase !== 'entering') return;
    if (firstEntry.current) firstEntry.current = false;
    else focus.handoffToWorld();
    dispatch({ type: 'ENTERED' });
  }, [s.phase, dispatch, focus]);

  /* readable mode has no walk and no withdrawal animation: its stop and boundary are on screen once painted */
  useEffect(() => {
    if (visual || !instance) return;
    if (s.phase === 'enacting') return afterPaint(() => setStoppedFor(instance));
    if (s.phase === 'boundary') return afterPaint(() => setWithdrawnFor(instance));
  }, [visual, s.phase, instance]);

  /* the public paper motif is fetched only once the boundary is reached (Design: after-boundary-public) */
  const boundaryReached = s.phase === 'boundary' || s.phase === 'reveal_loading' || s.phase === 'revealed' || s.phase === 'ended';
  useEffect(() => {
    if (!boundaryReached || motif || assetMode !== 'full') return;
    let live = true;
    assets.prepare([staging.props.authorPage]).then(
      () => live && setMotif(assets.url(staging.props.authorPage)),
      () => undefined // the motif is decorative; the boundary and the account do not depend on it
    );
    return () => {
      live = false;
    };
  }, [boundaryReached, motif, assets, staging, assetMode]);

  /* ------------------------------------------- devices → controller --- */
  const sendTarget = (target: EntityRef, activationId: string) => {
    if (dispatch({ type: 'SELECT_TARGET', target }).rejected) return false;
    const t = targetActions(m, getState(), target);
    if (!(t.observations.length + t.preparations.length + t.portals.length + t.opportunities.length)) {
      dispatch({ type: 'CLEAR_TARGET' });
      return false;
    }
    dispatch({ type: 'ACTIVATE_CONTEXT', activationId });
    return true;
  };
  const prepFor = (role: string | undefined) => (role ? readable.preparations.find(p => p.available && !p.applied && m.preparations.find(x => x.id === p.id)?.action.kind === 'reposition' && (m.preparations.find(x => x.id === p.id)!.action as { markRole: string }).markRole === role) : undefined);

  intentRef.current = (i: InputIntent) => {
    props.onIntent?.(i);
    switch (i.type) {
      case 'activate': {
        if (i.source === 'key' || !i.point || !viewport.current) {
          dispatch({ type: 'ACTIVATE_CONTEXT', activationId: i.activationId });
          break;
        }
        const hit = viewport.current.hitTest(i.point[0], i.point[1]);
        if (hit.kind === 'hero') {
          const summary = m.initialEntities.find(e => e.kind === 'object' && s.entities.find(x => x.id === e.id)?.owner.id === m.perspectiveActor);
          const opened = (summary && sendTarget({ kind: 'object', id: summary.id }, i.activationId)) || sendTarget({ kind: 'self' }, i.activationId);
          if (!opened) focus.announce('Nothing to do with yourself right now.');
        } else if (hit.kind === 'actor' || hit.kind === 'object') {
          if (!sendTarget({ kind: hit.kind, id: hit.id }, i.activationId)) focus.announce('Nothing to do there right now.');
        } else if (hit.kind === 'floor') {
          const prep = prepFor(hit.nearestRole);
          if (prep && hit.legal) dispatch(readableEvents.prepare(prep.id, i.activationId));
          else if (!hit.legal && !hit.nearestRole) focus.announce('You cannot stand there.');
          else focus.announce('Nowhere to move to there right now.');
        }
        break;
      }
      case 'cancel': {
        const r = dispatch({ type: 'CANCEL' });
        if (r.rejected && i.scope === 'world') focus.releaseWorld();
        break;
      }
      case 'movement_blocked':
        focus.announce('Movement is not available right now.');
        break;
      case 'move': {
        if (i.reason !== 'input' || (i.vector[0] === 0 && i.vector[1] === 0)) break;
        // Bounded local movement: step to the supported mark in that direction (a reversible preparation).
        const vp = viewport.current;
        const hero = getState().entities.find(e => e.id === m.perspectiveActor);
        const cs = m.compiledScenes.find(c => c.id === s.scene);
        const here = hero?.mark && vp ? vp.pointOnStage(hero.mark.x, hero.mark.y) : undefined;
        let best: { id: string; d: number } | undefined;
        for (const p of readable.preparations) {
          const plan = m.preparations.find(x => x.id === p.id)!;
          if (!p.available || p.applied || plan.action.kind !== 'reposition' || !cs?.marks?.[plan.action.markRole]) continue;
          const at = vp?.markOnStage(plan.action.markRole);
          if (!at || !here) continue;
          const dx = at.x - here.x;
          const dy = at.y - here.y;
          const along = dx * i.vector[0] + dy * i.vector[1];
          if (along <= 0) continue;
          const d = Math.hypot(dx, dy);
          if (!best || d < best.d) best = { id: p.id, d };
        }
        if (best) dispatch(readableEvents.prepare(best.id));
        else focus.announce('No other place to stand in that direction.');
        break;
      }
    }
  };

  /* ----------------------------------------------------------- views --- */
  const sceneBeats = new Set(plan.beats.map(b => b.id));
  const lastBeat = [...s.deliveredBeats].reverse().find(b => sceneBeats.has(b));
  const lines = beatFacts(m, plan, lastBeat);
  const playing = s.phase === 'playing' || s.phase === 'confirming';
  const decisionVisible = playing && readable.actions.some(a => a.available || a.id === s.reservation?.option);
  const anchored = visual && orientation === 'landscape';
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Controls drawn on the stage are native buttons; their pointer events must not also be read as a stage tap.
  const overlayNode = useCallback((el: HTMLDivElement | null) => {
    if (overlayRef.current === el) return;
    overlayRef.current = el;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    el.addEventListener('pointerup', stop);
  }, []);
  const decisionCopy: DecisionCopy = copy;

  const stageOverlay = (l: OverlayLayout) =>
    anchored && decisionVisible ? (
      <div ref={overlayNode} className="v3p-stage-controls">
        <DecisionProjectionV3 readable={readable} reserved={s.reservation?.option} copy={decisionCopy} dispatch={dispatch} activation={activation} mode="anchored" overlay={l} staging={staging} />
      </div>
    ) : null;

  const persistenceProblem = !!s.decision && !!status.persistence.error;
  const showStage = visual && s.phase !== 'reveal_loading' && s.phase !== 'revealed' && s.phase !== 'ended';
  const stageReady = s.phase !== 'loading';

  return (
    <section className={`v3p${reducedMotion ? ' is-reduced-motion' : ''}${readableMode ? ' is-readable' : ''}`} lang={m.locale} aria-label={copy.title} data-testid="player" data-phase={s.phase} data-scene={s.scene} data-orientation={orientation}>
      <header className="v3p-header">
        <p className="v3p-fiction-label" data-testid="fiction-label">
          {copy.disclosure}
        </p>
        <h1 className="v3p-title">{copy.title}</h1>
        <div className="v3p-settings" role="group" aria-label="Display settings">
          <button type="button" aria-pressed={readableMode} data-testid="toggle-readable" onClick={() => (setReadableMode(!readableMode), prefs.write('readable', !readableMode))}>
            Readable mode
          </button>
          <button type="button" aria-pressed={reducedMotion} data-testid="toggle-reduced-motion" onClick={() => setReducedMotion(!reducedMotion)}>
            Reduce motion
          </button>
        </div>
      </header>

      <div className="v3p-main">
        {showStage && stageReady && (
          <div className="v3p-stage-col">
            <WorldEntryButton>Enter the scene</WorldEntryButton>
            <WorldSurface label={`${copy.describeScene(s.scene)} Tap or press Enter for actions; arrow keys step between places you can stand; Tab leaves.`} className="v3p-world">
              <SceneViewportV3
                ref={viewport}
                manifest={m}
                state={s}
                staging={staging}
                geometry={geometry}
                assets={assets}
                orientation={orientation}
                reducedMotion={reducedMotion}
                displayTitle={copy.displayTitle}
                act={act}
                onActStopped={setStoppedFor}
                onWithdrawn={setWithdrawnFor}
                overlay={stageOverlay}
              />
            </WorldSurface>
          </div>
        )}
        {!visual && assetMode === 'readable' && s.phase !== 'loading' && (
          <p className="v3p-hint" data-testid="readable-fallback">
            Pictures are off. The same story, choices and author’s account continue in text.{' '}
            <button type="button" data-testid="pictures-on" onClick={() => onAssetMode('full')}>
              Try pictures again
            </button>
          </p>
        )}

        <div className="v3p-panel" data-testid="panel">
          <StatusAlerts s={s} host={host} status={status} lastPortal={lastPortal} dispatch={dispatch} activation={activation} onAssetMode={onAssetMode} persistenceProblem={persistenceProblem} />

          {(playing || s.phase === 'entering' || s.phase === 'transitioning') && (
            <section className="v3p-story" aria-label="Story" aria-live="polite" data-testid="story">
              {!lastBeat && s.scene === m.spine[0] && <p className="v3p-hook">{copy.hook}</p>}
              {lines.map(f => (
                <p key={f.id} className={`v3p-line is-${f.kind}`} data-testid={`line-${f.id}`}>
                  <FactText text={f.text} />
                </p>
              ))}
            </section>
          )}

          {playing && (
            <Actions readable={readable} dispatch={dispatch} activation={activation} onTravel={id => (lastPortal.current = id)} />
          )}

          {decisionVisible && !anchored && <DecisionProjectionV3 readable={readable} reserved={s.reservation?.option} copy={decisionCopy} dispatch={dispatch} activation={activation} mode="stacked" />}
          {decisionVisible && anchored && <p className="v3p-hint" data-testid="decision-hint">Your three possible acts are placed in the room above. Choosing opens a confirmation.</p>}

          {(s.phase === 'enacting' || s.phase === 'holding') && act && <CorrectionEnactment host={host} phase={s.phase} instance={instance} caption={copy.intention(act.option)} stopped={stoppedFor === instance} reducedMotion={reducedMotion} />}
          {s.phase === 'boundary' && act && (
            <>
              <p className="v3p-caption is-held" data-testid="held-caption">
                {copy.intention(act.option)}
              </p>
              <CorrectionBoundary host={host} status={status} phase={s.phase} instance={instance} withdrawn={withdrawnFor === instance} boundaryLine={copy.boundaryLine} disclosure={copy.disclosure} motifSrc={motif} />
            </>
          )}
          {(s.phase === 'reveal_loading' || s.phase === 'revealed' || s.phase === 'ended') && (
            <PrivateRevealV3
              phase={s.phase}
              status={status}
              record={host.revealRecord()}
              bridge={copy.boundaryLine}
              disclosure={copy.disclosure}
              motifSrc={motif}
              onRetry={() => host.retryReveal()}
              onFinish={() => dispatch({ type: 'END' })}
              onDisclosure={props.onDisclosure}
            />
          )}

          {(playing || readableMode) && readable.facts.length > 0 && !boundaryReached && (
            <section className="v3p-context" aria-label="What you know">
              {!readableMode && (
                <button type="button" aria-expanded={contextOpen} aria-controls="v3p-transcript" data-testid="context-toggle" onClick={() => setContextOpen(!contextOpen)}>
                  Context
                </button>
              )}
              {(contextOpen || readableMode) && (
                <ol id="v3p-transcript" data-testid="transcript">
                  {readable.facts.map(f => (
                    <li key={f.id}>
                      <FactText text={f.text} />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </div>

      <ObservationInsert m={m} s={s} copy={copy} dispatch={dispatch} />
      <ContextSheet m={m} s={s} readable={readable} dispatch={dispatch} activation={activation} copy={copy} />
      <ConfirmDialogV3 option={s.phase === 'confirming' ? s.reservation?.option : undefined} copy={decisionCopy} dispatch={dispatch} activation={activation} />
      <p className="v3p-sr-only" data-testid="host-status">{`entry:${status.entry} transition:${status.transition.state} gate:${status.revealGate} journal:${status.persistence.journal} repo:${status.persistence.repository} reveal:${status.reveal.state}`}</p>
    </section>
  );
}

/* -------------------------------------------------------------- pieces --- */

function Actions({ readable, dispatch, activation, onTravel }: { readable: ReadableModel; dispatch: (e: ExperienceEvent) => StepResult; activation: (e: React.SyntheticEvent) => string; onTravel: (id: string) => void }) {
  const obs = readable.observations.filter(o => o.available);
  const preps = readable.preparations.filter(p => p.available || p.applied);
  const doors = readable.portals.filter(p => p.available);
  if (!readable.canAdvance && !obs.length && !preps.length && !doors.length) return null;
  return (
    <section className="v3p-actions" aria-label="What you can do" data-testid="actions">
      {readable.canAdvance && (
        <button type="button" className="v3p-primary" data-testid="advance" onClick={e => dispatch(readableEvents.advance(activation(e)))}>
          Continue
        </button>
      )}
      {obs.map(o => (
        <button key={o.id} type="button" data-testid={`observe-${o.id}`} onClick={e => dispatch(readableEvents.observe(o.id, activation(e)))}>
          {o.label}
          {o.seen ? <span className="v3p-sr-only"> (already seen)</span> : null}
        </button>
      ))}
      {preps.map(p => (
        <button key={p.id} type="button" aria-pressed={p.applied} data-testid={`prepare-${p.id}`} onClick={e => dispatch(p.applied ? readableEvents.undoPreparation(p.id, activation(e)) : readableEvents.prepare(p.id, activation(e)))}>
          {p.label}
        </button>
      ))}
      {doors.map(p => (
        <button
          key={p.id}
          type="button"
          className={p.kind === 'spine' ? 'v3p-primary' : undefined}
          data-testid={`travel-${p.id}`}
          onClick={e => {
            onTravel(p.id);
            dispatch(readableEvents.travel(p.id, activation(e)));
          }}
        >
          {p.label}
        </button>
      ))}
    </section>
  );
}

function StatusAlerts({ s, host, status, lastPortal, dispatch, activation, onAssetMode, persistenceProblem }: { s: RuntimeSnapshot; host: ExperienceHost; status: ReturnType<ExperienceHost['getStatus']>; lastPortal: React.MutableRefObject<string | undefined>; dispatch: (e: ExperienceEvent) => StepResult; activation: (e: React.SyntheticEvent) => string; onAssetMode: (m: 'full' | 'readable') => void; persistenceProblem: boolean }) {
  return (
    <>
      {s.phase === 'loading' && status.entry !== 'failed' && (
        <p role="status" data-testid="entry-preparing">
          Preparing the scene…
        </p>
      )}
      {s.phase === 'loading' && status.entry === 'failed' && (
        <p role="alert" data-testid="entry-failed">
          The scene did not load.{' '}
          <button type="button" data-testid="entry-retry" onClick={() => host.retryEntry()}>
            Try again
          </button>{' '}
          <button type="button" data-testid="entry-readable" onClick={() => (onAssetMode('readable'), queueMicrotask(() => host.retryEntry()))}>
            Continue without pictures
          </button>
        </p>
      )}
      {s.phase === 'transitioning' && (
        <p role="status" data-testid="transition-preparing">
          Preparing the next place… You are still here until it is ready.
        </p>
      )}
      {s.phase === 'playing' && status.transition.state === 'failed' && (
        <p role="alert" data-testid="transition-failed">
          That place did not load. You are still here.{' '}
          {lastPortal.current && (
            <button type="button" data-testid="transition-retry" onClick={e => dispatch(readableEvents.travel(lastPortal.current!, activation(e)))}>
              Try again
            </button>
          )}{' '}
          <button type="button" data-testid="transition-readable" onClick={() => onAssetMode('readable')}>
            Continue without pictures
          </button>
        </p>
      )}
      {persistenceProblem && (
        <p role="alert" data-testid="persistence-failed">
          {status.persistence.durable ? 'Your act is kept on this device; the save service did not confirm it yet.' : 'Your act is accepted but not saved yet.'}{' '}
          <button type="button" data-testid="persistence-retry" onClick={() => host.retryPersistence()}>
            Save again
          </button>
        </p>
      )}
    </>
  );
}

function ObservationInsert({ m, s, copy, dispatch }: { m: PlaybackManifestV3; s: RuntimeSnapshot; copy: PlayerCopy; dispatch: (e: ExperienceEvent) => StepResult }) {
  const obs = m.observations.find(o => o.id === s.openObservation);
  return (
    <ScopeDialog open={!!obs} modal={false} label={obs?.label ?? 'Observation'} testId="observation" className="v3p-dialog v3p-observation">
      {obs && (
        <>
          <h3 tabIndex={-1} data-v3-initial-focus="">
            {obs.label}
          </h3>
          {copy.insert?.(obs.id) ?? <p>{copy.observations[obs.id]}</p>}
          {obs.facts.map(id => (
            <p key={id} className="v3p-line" data-testid={`observation-fact-${id}`}>
              <FactText text={m.facts.find(f => f.id === id)!.text} />
            </p>
          ))}
          <button type="button" data-testid="observation-close" onClick={() => dispatch({ type: 'CLOSE_OBSERVATION' })}>
            Close
          </button>
        </>
      )}
    </ScopeDialog>
  );
}

/** The contextual list a stage tap or Enter opens: the same commands as the panel, for one target or for all. */
function ContextSheet({ m, s, readable, dispatch, activation, copy }: { m: PlaybackManifestV3; s: RuntimeSnapshot; readable: ReadableModel; dispatch: (e: ExperienceEvent) => StepResult; activation: (e: React.SyntheticEvent) => string; copy: PlayerCopy }) {
  const open = !!s.sheet;
  const t = s.sheet?.kind === 'target' && s.sheet.target ? targetActions(m, s, s.sheet.target) : undefined;
  const allow = <T extends { id: string }>(x: T, list?: Array<{ id: string }>) => !t || (list ?? []).some(y => y.id === x.id);
  const items = useMemo(
    () => ({
      obs: readable.observations.filter(o => o.available && allow(o, t?.observations)),
      preps: readable.preparations.filter(p => p.available && !p.applied && allow(p, t?.preparations)),
      doors: readable.portals.filter(p => p.available && allow(p, t?.portals)),
      acts: readable.actions.filter(a => a.available && allow(a, t?.opportunities)),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [readable, s.sheet]
  );
  return (
    <ScopeDialog open={open} modal label="Actions" focusKey={`${s.sheet?.kind}:${s.sheet?.target ? refKey(s.sheet.target) : ''}`} testId="sheet" className="v3p-dialog v3p-sheet">
      <h3 tabIndex={-1}>Actions</h3>
      <ul>
        {items.obs.map(o => (
          <li key={o.id}>
            <button type="button" data-testid={`sheet-observe-${o.id}`} onClick={e => dispatch(readableEvents.observe(o.id, activation(e)))}>
              {o.label}
            </button>
          </li>
        ))}
        {items.preps.map(p => (
          <li key={p.id}>
            <button type="button" data-testid={`sheet-prepare-${p.id}`} onClick={e => dispatch(readableEvents.prepare(p.id, activation(e)))}>
              {p.label}
            </button>
          </li>
        ))}
        {items.doors.map(p => (
          <li key={p.id}>
            <button type="button" data-testid={`sheet-travel-${p.id}`} onClick={e => dispatch(readableEvents.travel(p.id, activation(e)))}>
              {p.label}
            </button>
          </li>
        ))}
        {items.acts.map(a => (
          <li key={a.id}>
            <button type="button" data-testid={`sheet-act-${a.id}`} onClick={e => dispatch(readableEvents.chooseAct(a.id, activation(e)))}>
              {copy.intention(a.id)}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" data-testid="sheet-close" onClick={() => dispatch({ type: 'CLOSE_SHEET' })}>
        Close
      </button>
    </ScopeDialog>
  );
}
