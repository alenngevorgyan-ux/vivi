import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import type { HeroStory } from '../data/heroStories';
import type { GameSpec } from '../types/gameSpec';
import { compileHeroStoryToRuntime, compileGameSpecToRuntime, type CanonicalScenario } from '../engine/runtime/RuntimeCompiler';
import type { StoredPlayablePost } from '../engine/runtime/generationPipeline';
import { CanonicalViviEngine, type ApproachDiagnostic, type MoveRequest } from './world/CanonicalViviEngine';
import { telemetry, type ProductBehaviorEventName } from '../engine/runtime/telemetry';
import { sealForPlayback } from '../engine/experience/playback';
import { initialExperienceState, step, type ExperienceEffect, type ExperienceEvent, type ExperienceState } from '../engine/experience/machine';
import type { Hotspot } from '../engine/experience/hotspots';
import { AFTER_DEED_PAUSE_MS, BOUNDARY_MS, enactmentScript } from '../engine/experience/enactment';
import type { ResolutionMode } from '../engine/experience/interaction';
import { persistChoice, readChoice, saveNote, sceneKey, type ChoiceRecord, type StorageLike } from '../engine/experience/choiceStore';
import { ui } from '../engine/experience/copy';
import { prefersReducedMotion } from '../assets/characters/animationClock';
import { ActionDock, type Modality } from './experience/ActionDock';
import { IntentMenu } from './experience/IntentMenu';
import { RevealView, type RelatedStory } from './experience/RevealView';
import { MemoryView } from './experience/MemoryView';

interface ViviPlayProps {
  story?: HeroStory | null;
  gameSpec?: GameSpec | null;
  scenario?: CanonicalScenario | null;
  /** The stored post, when there is one: its prompt is the author's text before the decision. */
  post?: StoredPlayablePost | null;
  related?: RelatedStory | null;
  onOpenRelated?: (id: string) => void;
  onExit: () => void;
  onRespondWithStory?: (responseToPostId: string, themeKey: string, inspirationPrompt: string) => void;
  isMuted?: boolean;
}

const safeStorage: StorageLike = {
  getItem: k => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // storage blocked: the experience still plays
    }
  },
};

export function ViviPlay({ story, gameSpec, scenario: directScenario, post, related, onOpenRelated, onExit, onRespondWithStory, isMuted = false }: ViviPlayProps) {
  const canonical: CanonicalScenario = useMemo(() => {
    if (directScenario) return directScenario;
    if (story) return compileHeroStoryToRuntime(story);
    if (gameSpec) return compileGameSpecToRuntime(gameSpec);
    throw new Error('ViviPlay requires either a story, gameSpec, or scenario.');
  }, [story, gameSpec, directScenario]);

  // The stage and the action list get a scene with no outcome in it; the reveal is opened only after a deed.
  const bundle = useMemo(() => sealForPlayback(canonical), [canonical]);
  const { scene, experience, sealed } = bundle;
  const lang = canonical.lang ?? (canonical.provenance?.source === 'legacy' || canonical.provenance?.source === 'hero_fixture' ? 'en' : 'ru');
  const t = (k: Parameters<typeof ui>[1]) => ui(lang, k);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const key = useMemo(
    () => sceneKey(canonical.id, canonical.provenance?.compilerVersion, experience.commitments.map(c => c.id)),
    [canonical, experience]
  );

  /* -------------------------------------------------------- scene clock --- */

  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const hiddenAtRef = useRef<number | null>(null);
  const [frozenAt, setFrozenAt] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (!document.hidden) setElapsed(Date.now() - startRef.current);
    };
    const onVisibility = () => {
      if (document.hidden) hiddenAtRef.current = Date.now();
      else if (hiddenAtRef.current !== null) {
        startRef.current += Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        update();
      }
    };
    const id = window.setInterval(update, 100);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  /* ------------------------------------------------------------ machine --- */

  const [state, setState] = useState<ExperienceState>(() => initialExperienceState());
  const stateRef = useRef(state);
  const [move, setMove] = useState<MoveRequest | null>(null);
  const nonce = useRef(0);
  const attemptRef = useRef(`${Date.now().toString(36)}-0`);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  const [record, setRecord] = useState<ChoiceRecord | undefined>(() => readChoice(safeStorage, key));
  const [arrivalMode, setArrivalMode] = useState<ResolutionMode | null>(null);

  const record_ = (name: string, id?: string) =>
    telemetry.recordEvent(name as ProductBehaviorEventName, elapsedRef.current, id ? { choiceId: id } : undefined);

  const perform = useCallback(
    (effects: ExperienceEffect[]) => {
      for (const effect of effects) {
        switch (effect.type) {
          case 'approach':
            setMove({ nonce: ++nonce.current, intentId: effect.id, kind: 'look' });
            break;
          case 'stop_approach':
            setMove(null);
            break;
          case 'persist_choice': {
            const rec = persistChoice(safeStorage, key, effect.id, attemptRef.current);
            setRecord(rec);
            // The feed's "my decisions" keeps working for scenes from before V2.
            try {
              const decisions = JSON.parse(localStorage.getItem('vivi_my_decisions') || '{}');
              if (!decisions[canonical.id]) {
                const label = experience.commitments.find(c => c.id === effect.id)?.label ?? effect.id;
                decisions[canonical.id] = { choiceId: effect.id, commitLabel: label, timestamp: Date.now() };
                localStorage.setItem('vivi_my_decisions', JSON.stringify(decisions));
              }
            } catch {
              // ignore
            }
            break;
          }
          case 'enact':
            setFrozenAt(elapsedRef.current);
            setMove({ nonce: ++nonce.current, intentId: effect.id, kind: 'deed' });
            break;
          case 'telemetry':
            record_(effect.name, effect.id);
            break;
        }
      }
    },
    [key, canonical.id, experience]
  );

  const dispatch = useCallback(
    (event: ExperienceEvent) => {
      const transition = step(stateRef.current, event);
      if (transition.state === stateRef.current) return;
      stateRef.current = transition.state;
      setState(transition.state);
      perform(transition.effects);
    },
    [perform]
  );

  useEffect(() => {
    telemetry.startSession(canonical.id);
    record_('experience_started');
  }, [canonical.id]);

  // Orientation ends when the decision moment has arrived.
  useEffect(() => {
    if (state.phase === 'orienting' && elapsed >= experience.orientationMs) dispatch({ type: 'ORIENTED' });
  }, [elapsed, state.phase, experience.orientationMs, dispatch]);

  // After the deed: a short pause, then the scene boundary, then the reveal.
  useEffect(() => {
    if (state.phase === 'pausing') {
      const id = window.setTimeout(() => dispatch({ type: 'PAUSED' }), reducedMotion ? 300 : AFTER_DEED_PAUSE_MS);
      return () => clearTimeout(id);
    }
    if (state.phase === 'boundary') {
      const id = window.setTimeout(() => dispatch({ type: 'BOUNDARY_DONE' }), reducedMotion ? 200 : BOUNDARY_MS);
      return () => clearTimeout(id);
    }
  }, [state.phase, dispatch, reducedMotion]);

  /* --------------------------------------------------------- hotspots --- */

  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const selected = hotspots.find(h => h.key === selectedKey);

  // A hotspot whose person has left is gone; so is its selection.
  useEffect(() => {
    if (selectedKey && !hotspots.some(h => h.key === selectedKey)) setSelectedKey(null);
  }, [hotspots, selectedKey]);

  /* ---------------------------------------------------- input modality --- */

  const [modality, setModality] = useState<Modality>(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches ? 'touch' : 'mouse'
  );
  const [keyboardOpened, setKeyboardOpened] = useState(false);
  useEffect(() => {
    const onPointer = (e: PointerEvent) => setModality(e.pointerType === 'touch' ? 'touch' : 'mouse');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Enter') setModality('keyboard');
    };
    window.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || menuOpen) return;
      const s = stateRef.current;
      if (s.phase === 'approaching' || s.phase === 'observing' || s.pendingId) dispatch({ type: 'CANCEL' });
      else if (selectedKey) setSelectedKey(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, menuOpen, selectedKey]);

  /* --------------------------------------------------------- handlers --- */

  const onLook = (id: string) => {
    setMenuOpen(false);
    const spot = hotspots.find(h => h.intents.some(i => i.id === id));
    if (spot) setSelectedKey(spot.key);
    dispatch({ type: 'LOOK', id });
  };
  const onPick = (id: string) => {
    setMenuOpen(false);
    const spot = hotspots.find(h => h.intents.some(i => i.id === id));
    if (spot) setSelectedKey(spot.key);
    dispatch({ type: 'PICK', id });
  };
  const onCommit = (id: string) => dispatch({ type: 'COMMIT', id });
  const onCancel = () => {
    if (state.phase === 'approaching' || state.phase === 'observing' || state.pendingId) dispatch({ type: 'CANCEL' });
    else setSelectedKey(null);
  };
  const onSkip = () => {
    if (state.phase === 'orienting') {
      // Jump the scene to the decision moment: everything before it still happened, only faster.
      startRef.current -= Math.max(0, experience.orientationMs - elapsedRef.current);
      setElapsed(Date.now() - startRef.current);
    }
    dispatch({ type: 'SKIP' });
  };

  const onSelectHotspot = (k: string) => {
    setKeyboardOpened(modality === 'keyboard');
    setSelectedKey(k);
    if (stateRef.current.pendingId || stateRef.current.phase === 'observing') dispatch({ type: 'CANCEL' });
    // A single look on its own hotspot needs no menu: go and look.
    const spot = hotspots.find(h => h.key === k);
    if (spot && spot.intents.length === 1 && spot.intents[0].kind === 'look') onLook(spot.intents[0].id);
  };

  const onApproachStarted = (d: ApproachDiagnostic) => {
    setArrivalMode(d.mode);
    record_(d.mode === 'walk' || d.mode === 'in_place' ? 'auto_approach_started' : 'auto_approach_recovered', d.intentId);
    if (import.meta.env.DEV && d.diagnostics.length) console.debug('[vivi] approach', d.intentId, d.mode, d.diagnostics.join('; '));
  };
  const onArrived = (id: string, mode: ResolutionMode) => {
    record_('auto_approach_completed', id);
    setArrivalMode(mode);
    if (stateRef.current.phase === 'approaching') dispatch({ type: 'ARRIVED', id });
  };
  const onEnacted = () => dispatch({ type: 'ENACTED' });

  const restart = () => {
    startRef.current = Date.now();
    hiddenAtRef.current = null;
    setElapsed(0);
    setFrozenAt(null);
    setMove(null);
    setSelectedKey(null);
    setMenuOpen(false);
    setArrivalMode(null);
    attemptRef.current = `${Date.now().toString(36)}-${stateRef.current.run + 1}`;
    dispatch({ type: 'RESTART' });
    setRunKey(k => k + 1);
  };
  const [runKey, setRunKey] = useState(0);

  const committed = state.committedId ? experience.commitments.find(c => c.id === state.committedId) : undefined;
  const script = committed ? enactmentScript(committed, t) : null;
  const respond = onRespondWithStory ? () => onRespondWithStory(canonical.id, canonical.themeKey, '') : undefined;

  /* ------------------------------------------------------------ render --- */

  if (experience.format !== 'playable' && experience.origin === 'compiled') {
    return <MemoryView scenario={scene} experience={experience} sealed={sealed} text={post?.inspirationPrompt || canonical.synopsis || canonical.setup} onSimilar={respond} onExit={onExit} />;
  }

  const revealed = state.phase === 'revealed';

  return (
    <main className={`vivi-play min-h-screen ${revealed ? 'is-revealed' : 'is-cinematic'}`} lang={lang}>
      <header className="vivi-play-header">
        <button className="vivi-back" onClick={onExit}>
          <ArrowLeft size={18} /> {t('feed')}
        </button>
        <div className="text-center">
          <span className="vivi-eyebrow">
            {canonical.authorHandle.toUpperCase()}
            {sealed.truth.status === 'fictional_demo' ? ` · ${(sealed.truth.sourceLabel?.includes('редакц') ? t('editorial') : t('demo')).toUpperCase()}` : ''}
          </span>
          <h1 className="text-xl sm:text-2xl font-serif text-stone-900">{canonical.title}</h1>
        </div>
        <button className="vivi-restart" onClick={restart} title={t('replay')} aria-label={t('replay')}>
          <RotateCcw size={18} />
        </button>
      </header>

      {!revealed ? (
        <div className="vivi-play-stage">
          <CanonicalViviEngine
            key={`${canonical.id}-${runKey}`}
            scenario={scene}
            experience={experience}
            elapsedMs={elapsed}
            worldFrozenAtMs={frozenAt}
            phase={state.phase}
            selectedKey={selectedKey}
            move={move}
            onSelectHotspot={onSelectHotspot}
            onHotspotsChange={setHotspots}
            onApproachStarted={onApproachStarted}
            onArrived={onArrived}
            onEnacted={onEnacted}
            onManualMove={() => dispatch({ type: 'CANCEL' })}
            isMuted={isMuted}
            reducedMotion={reducedMotion}
          />
          <ActionDock
            lang={lang}
            experience={experience}
            state={state}
            hotspot={selected}
            modality={modality}
            script={script}
            arrivalMode={arrivalMode}
            onLook={onLook}
            onPick={onPick}
            onCommit={onCommit}
            onCancel={onCancel}
            onCloseObservation={() => dispatch({ type: 'CLOSE_OBSERVATION' })}
            onOpenMenu={() => setMenuOpen(true)}
            onSkip={onSkip}
            focusOnOpen={keyboardOpened || modality === 'keyboard'}
          />
          {menuOpen && <IntentMenu lang={lang} experience={experience} hotspots={hotspots} onLook={onLook} onPick={onPick} onClose={() => setMenuOpen(false)} />}
        </div>
      ) : (
        <RevealView
          lang={lang}
          chosen={committed}
          commitments={experience.commitments}
          sealed={sealed}
          record={record}
          related={related}
          onSaveNote={n => setRecord(saveNote(safeStorage, key, n) ?? record)}
          onSimilar={respond}
          onOpenRelated={id => {
            record_('related_story_opened', id);
            onOpenRelated?.(id);
          }}
          onReplay={restart}
          onExit={onExit}
        />
      )}
    </main>
  );
}
