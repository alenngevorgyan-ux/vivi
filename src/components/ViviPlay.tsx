import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  Heart,
  Bookmark,
  Share2,
  Sparkles,
  MessageSquare,
  Lock,
  CheckCircle,
  HelpCircle,
  Info,
} from 'lucide-react';
import type { HeroStory } from '../data/heroStories';
import type { GameSpec } from '../types/gameSpec';
import {
  compileHeroStoryToRuntime,
  compileGameSpecToRuntime,
  type CanonicalScenario,
  type RuntimeAction,
  type CommunityReflection,
  type AuthorTruthStatus,
} from '../engine/runtime/RuntimeCompiler';
import { CanonicalViviEngine } from './world/CanonicalViviEngine';
import { StoryBeatRunner, type BeatRunnerState } from '../engine/runtime/StoryBeatRunner';
import { telemetry } from '../engine/runtime/telemetry';

interface ViviPlayProps {
  story?: HeroStory | null;
  gameSpec?: GameSpec | null;
  scenario?: CanonicalScenario | null;
  onExit: () => void;
  onRespondWithStory?: (responseToPostId: string, themeKey: string, inspirationPrompt: string) => void;
  isMuted?: boolean;
}

export function ViviPlay({
  story,
  gameSpec,
  scenario: directScenario,
  onExit,
  onRespondWithStory,
  isMuted = false,
}: ViviPlayProps) {
  // Compile into canonical scenario format
  const canonicalScenario: CanonicalScenario = useMemo(() => {
    if (directScenario) return directScenario;
    if (story) return compileHeroStoryToRuntime(story);
    if (gameSpec) return compileGameSpecToRuntime(gameSpec);
    throw new Error('ViviPlay requires either a story, gameSpec, or scenario.');
  }, [story, gameSpec, directScenario]);

  // Session timer
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const hiddenAtRef = useRef<number | null>(null);
  const [runId, setRunId] = useState(0);

  // Authoritative StoryBeatRunner instance
  const [beatState, setBeatState] = useState<BeatRunnerState>(() => {
    const runner = new StoryBeatRunner(canonicalScenario.beats);
    return runner.getState();
  });

  const beatRunner = useMemo(() => {
    const runner = new StoryBeatRunner(canonicalScenario.beats, (newState) => {
      setBeatState({ ...newState });
    });
    setBeatState(runner.getState());
    return runner;
  }, [canonicalScenario, runId]);

  // Gameplay state
  const [selectedAction, setSelectedAction] = useState<RuntimeAction | null>(null);
  const [committed, setCommitted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [observations, setObservations] = useState<string[]>([]);
  const [activeObservation, setActiveObservation] = useState<string | null>(null);
  const [commitAttemptWarning, setCommitAttemptWarning] = useState<string | null>(null);

  // Social interactions state (persisted in localStorage)
  const [reflections, setReflections] = useState<CommunityReflection[]>(() => {
    try {
      const stored = localStorage.getItem(`vivi_reflections_${canonicalScenario.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      // ignore
    }
    return canonicalScenario.communityReflections;
  });

  const [hasResonated, setHasResonated] = useState(() => {
    try {
      return localStorage.getItem(`vivi_resonated_${canonicalScenario.id}`) === 'true';
    } catch {
      return false;
    }
  });

  const [isBookmarked, setIsBookmarked] = useState(() => {
    try {
      return localStorage.getItem(`vivi_bookmarked_${canonicalScenario.id}`) === 'true';
    } catch {
      return false;
    }
  });

  const [resonanceCount, setResonanceCount] = useState(() => {
    return 84 + Math.floor(Math.sin(canonicalScenario.id.length) * 20 + 20) + (hasResonated ? 1 : 0);
  });

  const [shareToast, setShareToast] = useState(false);
  const [userReflectionText, setUserReflectionText] = useState('');
  const [isReflectionSubmitted, setIsReflectionSubmitted] = useState(false);

  // Telemetry session start
  useEffect(() => {
    telemetry.startSession(canonicalScenario.id);
  }, [canonicalScenario.id]);

  // Authoritative tick loop feeding StoryBeatRunner
  useEffect(() => {
    const update = () => {
      if (!document.hidden) {
        const currentElapsed = Date.now() - startRef.current;
        setElapsed(currentElapsed);
        beatRunner.checkTick(currentElapsed);
      }
    };

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else if (hiddenAtRef.current !== null) {
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
  }, [beatRunner]);

  const handleActionInspected = (action: RuntimeAction) => {
    setSelectedAction(action);
    setCommitAttemptWarning(null);
    setObservations(prev => (prev.includes(action.observation) ? prev : [action.observation, ...prev]));
    setActiveObservation(action.observation);
  };

  useEffect(() => {
    if (!activeObservation) return;
    const id = window.setTimeout(() => setActiveObservation(null), 5200);
    return () => clearTimeout(id);
  }, [activeObservation]);

  const handleCommit = (action: RuntimeAction) => {
    // Enforce physical discovery: action must have been physically inspected
    if (!beatRunner.isActionUnlocked(action.id)) {
      setCommitAttemptWarning('Сначала подойдите к объекту в сцене и исследуйте его.');
      return;
    }

    if (!beatState.canCommit) {
      setCommitAttemptWarning('Момент для решения еще не настал. Исследуйте обстановку.');
      return;
    }

    try {
      beatRunner.commitDecision(action.id);
      setSelectedAction(action);
      setCommitted(true);
      setCommitAttemptWarning(null);
      telemetry.recordEvent('decision_committed', elapsed, { choiceId: action.id });

      // Save user decision locally
      const decisions = JSON.parse(localStorage.getItem('vivi_my_decisions') || '{}');
      decisions[canonicalScenario.id] = {
        choiceId: action.id,
        commitLabel: action.commitLabel,
        timestamp: Date.now(),
      };
      localStorage.setItem('vivi_my_decisions', JSON.stringify(decisions));
    } catch (err: any) {
      setCommitAttemptWarning(err?.message || 'Действие заблокировано');
    }
  };

  const handleReveal = () => {
    setRevealed(true);
    beatRunner.triggerReveal();
    telemetry.recordEvent('reveal_seen', elapsed);
  };

  const toggleResonance = () => {
    const next = !hasResonated;
    setHasResonated(next);
    setResonanceCount(prev => (next ? prev + 1 : Math.max(0, prev - 1)));
    try {
      localStorage.setItem(`vivi_resonated_${canonicalScenario.id}`, String(next));
    } catch {}
  };

  const toggleBookmark = () => {
    const next = !isBookmarked;
    setIsBookmarked(next);
    try {
      localStorage.setItem(`vivi_bookmarked_${canonicalScenario.id}`, String(next));
    } catch {}
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2400);
    }
  };

  const handleAddReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userReflectionText.trim()) return;

    const newRef: CommunityReflection = {
      id: `ref_user_${Date.now()}`,
      authorHandle: '@you',
      authorName: 'Вы',
      choiceLabel: selectedAction?.commitLabel,
      text: userReflectionText.trim(),
      timestamp: 'Только что',
      upvotes: 1,
      source: 'user_local',
    };

    const updated = [newRef, ...reflections];
    setReflections(updated);
    setUserReflectionText('');
    setIsReflectionSubmitted(true);

    try {
      localStorage.setItem(`vivi_reflections_${canonicalScenario.id}`, JSON.stringify(updated));
    } catch {}
  };

  const restart = () => {
    startRef.current = Date.now();
    hiddenAtRef.current = null;
    setElapsed(0);
    setSelectedAction(null);
    setCommitted(false);
    setRevealed(false);
    setObservations([]);
    setActiveObservation(null);
    setIsReflectionSubmitted(false);
    setCommitAttemptWarning(null);
    beatRunner.reset();
    setBeatState(beatRunner.getState());
    setRunId(prev => prev + 1);
  };

  const selectedEnding = selectedAction ? canonicalScenario.endings[selectedAction.id] : '';
  const truthStatus: AuthorTruthStatus =
    canonicalScenario.authorTruth?.status ||
    (canonicalScenario.reality ? 'author_supplied' : 'withheld');
  const truthText = canonicalScenario.authorTruth?.text || canonicalScenario.reality || '';
  const truthSourceLabel =
    canonicalScenario.authorTruth?.sourceLabel ||
    (truthStatus === 'author_supplied'
      ? 'со слов автора'
      : truthStatus === 'fictional_demo'
      ? 'Заданная для демо развязка'
      : 'НЕ РАСКРЫТО');

  return (
    <main className={`vivi-play min-h-screen ${committed ? 'is-debrief' : 'is-cinematic'}`}>
      {/* Top Bar with Story Metadata & Social Actions */}
      <header className="vivi-play-header">
        <button className="vivi-back" onClick={onExit}>
          <ArrowLeft size={18} /> Лента
        </button>

        <div className="text-center">
          <span className="vivi-eyebrow">
            BY {canonicalScenario.authorHandle.toUpperCase()} · {canonicalScenario.duration.toUpperCase()}
          </span>
          <h1 className="text-xl sm:text-2xl font-serif text-stone-900">{canonicalScenario.title}</h1>
        </div>

        {/* Social chrome stays out of the way until the situation has resolved. */}
        <div className="flex items-center gap-2 vivi-social-actions">
          <button
            onClick={toggleResonance}
            className={`p-2 rounded-lg flex items-center gap-1.5 text-xs transition-colors ${
              hasResonated
                ? 'bg-rose-100 text-rose-700 font-semibold'
                : 'text-stone-600 hover:bg-stone-200'
            }`}
            title="Отозвалось / Felt this"
          >
            <Heart size={16} className={hasResonated ? 'fill-rose-600 text-rose-600' : ''} />
            <span>{resonanceCount}</span>
          </button>

          <button
            onClick={toggleBookmark}
            className={`p-2 rounded-lg text-xs transition-colors ${
              isBookmarked
                ? 'bg-amber-100 text-amber-800 font-semibold'
                : 'text-stone-600 hover:bg-stone-200'
            }`}
            title="Сохранить / Bookmark"
          >
            <Bookmark size={16} className={isBookmarked ? 'fill-amber-600 text-amber-600' : ''} />
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-lg text-stone-600 hover:bg-stone-200 text-xs"
            title="Поделиться ситуацией"
          >
            <Share2 size={16} />
          </button>

          <button className="vivi-restart" onClick={restart} title="Начать заново">
            <RotateCcw size={18} />
          </button>
        </div>
      </header>

      {shareToast && (
        <div className="fixed top-16 right-6 z-50 px-4 py-2 rounded-lg bg-stone-900 text-stone-100 text-xs shadow-xl animate-fade-in">
          Ссылка на ситуацию скопирована
        </div>
      )}

      {/* Main Experience Layout: 2D Stage + Authoritative Narrative & Social Panel */}
      <div className="vivi-play-layout">
        {/* Canonical Physical 2D World (Enforces physical proximity) */}
        <section className="vivi-stage-shell">
          <CanonicalViviEngine
            key={`canonical-engine-${canonicalScenario.id}-${runId}`}
            scenario={canonicalScenario}
            elapsedMs={elapsed}
            beatRunner={beatRunner}
            selectedAction={selectedAction}
            onActionInspected={handleActionInspected}
            committed={committed}
            revealed={revealed}
            onCommit={handleCommit}
            latestObservation={activeObservation}
            isMuted={isMuted}
          />
        </section>

        {/* Right Authoritative Narrative Panel: reveal, compare and respond. */}
        {committed && (
        <aside className="vivi-story-panel overflow-y-auto max-h-[85vh]">
          {/* Situation Setup */}
          <div className="vivi-panel-top">
            <span className="vivi-eyebrow">
              {canonicalScenario.pillar.toUpperCase()} · SITUATION IN PROGRESS
            </span>
            <h2>
              {committed
                ? 'Вы сделали выбор.'
                : beatState.cueTriggered
                ? 'Ваш следующий шаг.'
                : 'Войдите в ситуацию.'}
            </h2>
            <p className="vivi-setup">{canonicalScenario.setup}</p>
          </div>

          {/* Authoritative Story Beats driven by StoryBeatRunner */}
          <div className="vivi-story-beats">
            <div className="vivi-beat">
              <span>01 / ВХОД</span>
              <p>{canonicalScenario.hook}</p>
            </div>

            {beatState.cueTriggered && (
              <div className="vivi-beat current">
                <span>02 / МОМЕНТ НАПРЯЖЕНИЯ</span>
                <p>{canonicalScenario.beats.find(b => b.isCue)?.description || 'Момент настал.'}</p>
              </div>
            )}

            {beatState.pressureTriggered && !committed && (
              <div className="vivi-beat pressure">
                <span>03 / ДАВЛЕНИЕ ВРЕМЕНИ</span>
                <p>{canonicalScenario.beats.find(b => b.isPressure)?.description || 'Секунды уходят.'}</p>
              </div>
            )}

            {observations.length > 0 && !committed && (
              <div className="vivi-beat observation">
                <span>ВЫ ИССЛЕДОВАЛИ</span>
                <p>{observations[0]}</p>
              </div>
            )}
          </div>

          {/* Physical Exploration hint before Cue */}
          {!beatState.cueTriggered && (
            <p className="vivi-wait-hint">
              Двигайтесь по комнате (W, A, S, D или стрелки). Ситуация развивается в реальном времени.
            </p>
          )}

          {/* Action Discovery List - Enforces Physical Inspection Before Commit */}
          {beatState.cueTriggered && !committed && (
            <div className="vivi-commit">
              <span className="vivi-eyebrow">ИССЛЕДУЙТЕ ТОЧКИ В МИРЕ, ЧТОБЫ ОТКРЫТЬ ДЕЙСТВИЯ</span>
              <div className="vivi-action-list">
                {canonicalScenario.actions.map(action => {
                  const isUnlocked = beatRunner.isActionUnlocked(action.id);
                  const isSelected = selectedAction?.id === action.id;

                  return (
                    <button
                      key={action.id}
                      disabled={!isUnlocked}
                      className={`${isSelected ? 'active' : ''} ${!isUnlocked ? 'opacity-50 cursor-not-allowed bg-stone-100 text-stone-400' : ''}`}
                      onClick={() => {
                        if (isUnlocked) {
                          setSelectedAction(action);
                          setCommitAttemptWarning(null);
                        }
                      }}
                      title={isUnlocked ? action.commitLabel : 'Подойдите к объекту в мире, чтобы исследовать'}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {!isUnlocked && <Lock size={12} className="text-stone-400 shrink-0" />}
                        <span className="truncate">{action.label}</span>
                      </div>
                      {isUnlocked && <ArrowRight size={14} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {commitAttemptWarning && (
                <p className="text-xs text-rose-700 font-medium my-2 flex items-center gap-1">
                  <Info size={13} /> {commitAttemptWarning}
                </p>
              )}

              {/* Commit Button: ONLY enabled when action was physically discovered */}
              <button
                className="vivi-button"
                disabled={!selectedAction || !beatRunner.isActionUnlocked(selectedAction.id) || !beatState.canCommit}
                onClick={() => {
                  if (selectedAction) handleCommit(selectedAction);
                }}
              >
                {selectedAction && beatRunner.isActionUnlocked(selectedAction.id)
                  ? selectedAction.commitLabel
                  : 'Подойдите к объекту в мире для действия'}
                <ArrowRight size={17} />
              </button>
            </div>
          )}

          {/* Post-Commitment Phase: Truth-Safe Reveal, Compare, and Community Respond */}
          {committed && (
            <div className="vivi-result">
              <span className="vivi-eyebrow">ВАША ЛИНИЯ</span>
              <p>{selectedEnding}</p>

              {!revealed ? (
                <button className="vivi-button mt-4" onClick={handleReveal}>
                  Узнать развязку <ArrowRight size={17} />
                </button>
              ) : (
                <>
                  {/* Truth-Safe Author Reveal: Zero Fabrication */}
                  <div className="vivi-reality">
                    <div className="flex items-center justify-between mb-1">
                      <span className="vivi-eyebrow">
                        {truthStatus === 'author_supplied'
                          ? 'ЧТО АВТОР РАССКАЗАЛ О РЕАЛЬНОМ ИСХОДЕ'
                          : truthStatus === 'fictional_demo'
                          ? 'ДЕМОНСТРАЦИОННЫЙ СЦЕНАРИЙ'
                          : 'ПРАВДА АВТОРА'}
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono">
                        {truthSourceLabel}
                      </span>
                    </div>

                    {truthStatus === 'author_supplied' && (
                      <p>{truthText}</p>
                    )}

                    {truthStatus === 'fictional_demo' && (
                      <div className="space-y-1">
                        <p className="text-xs text-stone-500 font-medium">Ниже — заданная для демо развязка.</p>
                        <p>{truthText}</p>
                      </div>
                    )}

                    {truthStatus === 'withheld' && (
                      <p className="italic text-stone-500 text-sm">
                        {canonicalScenario.authorTruth?.withheldReason || 'Автор пока не раскрыл, что произошло.'}
                      </p>
                    )}
                  </div>

                  {/* 1. Honest Crowd Compare: ТЫ · АВТОР · ДРУГИЕ with Explicit Data Provenance */}
                  <div className="vivi-compare border-t border-stone-200 pt-5 mt-5">
                    <div className="flex items-center justify-between">
                      <span className="vivi-eyebrow">ВЫБОР СООБЩЕСТВА</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-200 text-stone-600 font-mono uppercase">
                        Пример распределения (демо)
                      </span>
                    </div>
                    <h3 className="text-lg font-serif mt-1">{canonicalScenario.crowdQuestion}</h3>
                    <p className="text-xs text-stone-500 mt-1 mb-4">
                      Сравнение ваших инстинктов с демонстрационным распределением и решением автора:
                    </p>

                    <div className="space-y-3">
                      {canonicalScenario.seededStats.map(stat => {
                        const isUserChoice = selectedAction?.id === stat.choiceId;
                        const isAuthorChoice = canonicalScenario.authorChoiceId === stat.choiceId;

                        return (
                          <div key={stat.choiceId} className="group">
                            <div className="flex justify-between items-center text-xs mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-stone-800">{stat.label}</span>
                                {isUserChoice && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-600 text-amber-50 font-mono text-[9px] font-bold">
                                    ТЫ
                                  </span>
                                )}
                                {isAuthorChoice && (
                                  <span className="px-1.5 py-0.5 rounded bg-stone-700 text-stone-200 font-mono text-[9px]">
                                    АВТОР
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-xs font-semibold text-stone-700">
                                {stat.percentage}%
                              </span>
                            </div>

                            {/* Percentage Progress Bar */}
                            <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${
                                  isUserChoice
                                    ? 'bg-amber-600'
                                    : isAuthorChoice
                                    ? 'bg-stone-600'
                                    : 'bg-stone-400'
                                }`}
                                style={{ width: `${stat.percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <small className="block mt-3 text-[10px] text-stone-400 font-mono">
                      * Демо-распределение приведено в иллюстративных целях; ваш выбор сохранен локально.
                    </small>
                  </div>

                  {/* 2. Primary Social CTA: "С тобой было похожее?" (Response-story flow) */}
                  <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-600/30">
                    <span className="vivi-eyebrow text-amber-900">С ТОБОЙ БЫЛО ПОХОЖЕЕ?</span>
                    <h4 className="font-serif text-lg text-stone-900 mt-1 mb-2">
                      Расскажи свою историю в ответ
                    </h4>
                    <p className="text-xs text-stone-700 leading-relaxed mb-3">
                      Каждая сложная ситуация порождает цепочки похожих моментов. Опишите свой случай — движок Vivi превратит его в маленький физический мир.
                    </p>
                    <button
                      className="vivi-button w-full flex items-center justify-center gap-2 text-xs py-2.5"
                      onClick={() => {
                        telemetry.recordEvent('response_cta_clicked', elapsed);
                        if (onRespondWithStory) {
                          onRespondWithStory(
                            canonicalScenario.id,
                            canonicalScenario.themeKey,
                            `В ответ на ситуацию "${canonicalScenario.title}": со мной произошло похожее…`
                          );
                        } else {
                          onExit();
                        }
                      }}
                    >
                      <Sparkles size={16} />
                      <span>Рассказать свою историю</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>

                  {/* 3. Community Reflections Feed with Honest Provenance */}
                  <div className="vivi-respond mt-6 border-t border-stone-200 pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="vivi-eyebrow flex items-center gap-1.5">
                        <MessageSquare size={13} />
                        ОТКЛИКИ ({reflections.length})
                      </span>
                      <span className="text-[9px] text-stone-400 font-mono">
                        ДЕМО-ОБРАЗЦЫ И ЛОКАЛЬНЫЕ ОТЗЫВЫ
                      </span>
                    </div>

                    {/* Reflection input */}
                    <form onSubmit={handleAddReflection} className="mb-4">
                      <label htmlFor="vivi-reflection-input" className="block text-xs font-medium text-stone-700 mb-1">
                        Что вы почувствовали или сказали бы автору?
                      </label>
                      <textarea
                        id="vivi-reflection-input"
                        value={userReflectionText}
                        onChange={(e) => setUserReflectionText(e.target.value)}
                        placeholder="Мысль, сопереживание или личный вывод…"
                        maxLength={280}
                        rows={2}
                        className="w-full text-xs p-2.5 rounded-lg border border-stone-300 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600 outline-none"
                      />
                      <div className="flex justify-between items-center mt-1.5">
                        <span className="text-[10px] text-stone-400">
                          {280 - userReflectionText.length} симв.
                        </span>
                        <button
                          type="submit"
                          disabled={!userReflectionText.trim()}
                          className="px-3 py-1 rounded bg-stone-900 text-stone-100 text-xs font-medium disabled:opacity-40"
                        >
                          Опубликовать отклик
                        </button>
                      </div>
                    </form>

                    {/* Reflections List */}
                    <div className="space-y-3 mt-4">
                      {reflections.map(ref => (
                        <div
                          key={ref.id}
                          className={`p-3 rounded-xl border text-xs ${
                            ref.source === 'user_local'
                              ? 'bg-amber-50/80 border-amber-300/80 shadow-sm'
                              : 'bg-stone-50 border-stone-200/80'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-stone-900 font-mono text-[11px]">
                                {ref.authorHandle}
                              </span>
                              {ref.source === 'user_local' ? (
                                <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white text-[9px] font-bold">
                                  ВАШ ОТКЛИК
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-stone-200 text-stone-600 text-[8px] font-mono">
                                  ДЕМО
                                </span>
                              )}
                              {ref.choiceLabel && (
                                <span className="text-[10px] text-stone-500 italic">
                                  · Выбор: «{ref.choiceLabel}»
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-stone-400">{ref.timestamp}</span>
                          </div>
                          <p className="text-stone-700 leading-relaxed font-serif text-[13px]">
                            {ref.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button className="vivi-text-button block mt-6 text-stone-600" onClick={restart}>
                    Попробовать другую ветку решений ↗
                  </button>
                </>
              )}
            </div>
          )}
        </aside>
        )}
      </div>

      {/* Footer */}
      <footer className="vivi-play-footer">
        <span>ENTER → EXPERIENCE → COMMIT → REVEAL → COMPARE → RESPOND</span>
        <span>CANONICAL VIVI ENGINE V2 · AUTHORITATIVE BEAT RUNNER</span>
      </footer>
    </main>
  );
}
