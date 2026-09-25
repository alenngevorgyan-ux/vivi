import React, { useState, useEffect } from 'react';
import {
  Heart,
  Zap,
  Coins,
  Shield,
  Brain,
  Wind,
  Flame,
  Clock,
  Sparkles,
  ChevronRight,
  RotateCcw,
  BookOpen,
  ArrowLeft,
  Lock,
  Dice5,
  Volume2,
  VolumeX,
  Award,
  Package,
  Check,
  Share2,
  Trophy,
  History,
  X,
} from 'lucide-react';
import {
  ActiveGameState,
  GameChoice,
  GameNode,
  GameSpec,
} from '../types/gameSpec';
import {
  canSelectChoice,
  executeChoice,
  initializeGameState,
  rewindToStep,
} from '../utils/gameEngine';
import { sounds } from '../utils/soundEffects';

interface PlayViewProps {
  gameSpec: GameSpec;
  onExit: () => void;
  onForkInStudio: (spec: GameSpec) => void;
}

export const PlayView: React.FC<PlayViewProps> = ({
  gameSpec,
  onExit,
  onForkInStudio,
}) => {
  const [gameState, setGameState] = useState<ActiveGameState>(() =>
    initializeGameState(gameSpec)
  );

  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [recentNotifications, setRecentNotifications] = useState<
    { id: string; message: string; positive?: boolean }[]
  >([]);

  // Dice roll modal animation state
  const [activeRoll, setActiveRoll] = useState<{
    stat: string;
    threshold: number;
    roll: number;
    success: boolean;
    pendingChoice: GameChoice;
  } | null>(null);

  const currentNode: GameNode = gameState.spec.nodes[gameState.currentNodeId] || {
    id: gameState.currentNodeId,
    title: 'Unknown Scene',
    narrative: 'The thread of this reality has dissolved.',
    choices: [],
  };

  // Play ambient sound on scene load
  useEffect(() => {
    if (currentNode.ambient) {
      sounds.playAmbient(currentNode.ambient);
    } else {
      sounds.stopAmbient();
    }

    if (currentNode.isEnding) {
      if (currentNode.endingType === 'victory' || currentNode.endingType === 'secret') {
        sounds.playVictory();
      } else {
        sounds.playTragedy();
      }
    }

    return () => {
      sounds.stopAmbient();
    };
  }, [gameState.currentNodeId]);

  // Handle choice execution
  const handleChoiceClick = (choice: GameChoice) => {
    const { canSelect } = canSelectChoice(gameState, choice);
    if (!canSelect) {
      sounds.playDamage();
      return;
    }

    // If risk outcome, show animated dice roll modal first
    if (choice.riskOutcome) {
      sounds.playChoice();
      const rollVal = Math.round(Math.random() * 100);
      const thresholdVal = Math.round(choice.riskOutcome.chance * 100);
      const isSuccess = rollVal <= thresholdVal;

      setActiveRoll({
        stat: choice.riskOutcome.rollStat || 'Skill',
        threshold: thresholdVal,
        roll: rollVal,
        success: isSuccess,
        pendingChoice: choice,
      });
      return;
    }

    // Direct transition
    sounds.playChoice();
    applyChoiceResult(choice);
  };

  const applyChoiceResult = (choice: GameChoice) => {
    const { newState, notifications } = executeChoice(gameState, choice);
    setGameState(newState);

    if (notifications.length > 0) {
      const toastList = notifications.map((n, i) => ({
        id: `${Date.now()}_${i}`,
        message: n.message,
        positive: n.positive,
      }));
      setRecentNotifications(toastList);

      setTimeout(() => {
        setRecentNotifications([]);
      }, 4000);
    }
  };

  const handleConfirmDiceRoll = () => {
    if (!activeRoll) return;
    sounds.playDiceRoll(activeRoll.success);
    applyChoiceResult(activeRoll.pendingChoice);
    setActiveRoll(null);
  };

  const handleRewind = (stepIndex: number) => {
    sounds.playClick();
    const rewound = rewindToStep(gameState, stepIndex);
    setGameState(rewound);
    setIsHistoryDrawerOpen(false);
  };

  const handleRestart = () => {
    sounds.playClick();
    setGameState(initializeGameState(gameSpec));
  };

  const handleShareEnding = () => {
    sounds.playHeal();
    const shareText = `I just reached "${currentNode.endingTitle || currentNode.title}" in ${gameSpec.title}! Play it on Mythos Interactive Fiction.`;
    navigator.clipboard.writeText(shareText);
    alert('Ending summary copied to clipboard!');
  };

  // Helper icon for stats
  const renderStatIcon = (iconName?: string) => {
    switch (iconName) {
      case 'heart':
        return <Heart className="w-4 h-4 text-rose-400 fill-rose-500/20" />;
      case 'brain':
        return <Brain className="w-4 h-4 text-purple-400" />;
      case 'coins':
        return <Coins className="w-4 h-4 text-amber-400" />;
      case 'wind':
        return <Wind className="w-4 h-4 text-cyan-400" />;
      case 'flame':
        return <Flame className="w-4 h-4 text-orange-400" />;
      case 'zap':
      default:
        return <Zap className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between">
      {/* Dynamic Cinematic Backdrop */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-all duration-1000 transform scale-105 filter blur-[2px] opacity-20"
          style={{
            backgroundImage: `url(${currentNode.sceneImage || gameSpec.coverImage})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/85 to-slate-950" />
      </div>

      {/* Top Floating Control Bar */}
      <div className="sticky top-16 z-30 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-4 py-2.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => {
                sounds.playClick();
                onExit();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800"
              title="Return to Story Feed"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="truncate">
              <span className="font-bold text-slate-200 font-cinzel block truncate">
                {gameSpec.title}
              </span>
              <span className="text-[10px] text-amber-400 font-code block truncate">
                {currentNode.chapter || 'Active Scene'}
              </span>
            </div>
          </div>

          {/* Right Tools */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Font Size Toggle */}
            <button
              onClick={() => {
                sounds.playClick();
                setFontSize((prev) => (prev === 'normal' ? 'large' : 'normal'));
              }}
              title="Toggle reading font size"
              className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 font-code text-[11px]"
            >
              {fontSize === 'normal' ? 'A+' : 'A-'}
            </button>

            {/* Inventory Toggle Button */}
            {gameState.inventory.length > 0 && (
              <button
                onClick={() => {
                  sounds.playClick();
                  setIsInventoryOpen(!isInventoryOpen);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300 transition-colors"
                title="Open Character Inventory"
              >
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-code font-bold">
                  {gameState.inventory.length}
                </span>
              </button>
            )}

            {/* History Timeline Button */}
            <button
              onClick={() => {
                sounds.playClick();
                setIsHistoryDrawerOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300 transition-colors"
              title="View History Timeline & Checkpoints"
            >
              <History className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px]">Timeline</span>
            </button>

            {/* Restart Button */}
            <button
              onClick={handleRestart}
              className="p-1.5 rounded text-slate-400 hover:text-rose-300 hover:bg-slate-900 border border-slate-800 transition-colors"
              title="Restart Story"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Stat Notification Toasts */}
      {recentNotifications.length > 0 && (
        <div className="fixed top-32 right-4 z-40 space-y-1.5 pointer-events-none">
          {recentNotifications.map((notif) => (
            <div
              key={notif.id}
              className={`px-3 py-1.5 rounded-lg border text-xs font-code font-bold shadow-lg backdrop-blur-md animate-bounce-short ${
                notif.positive
                  ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/90 border-rose-500/40 text-rose-300'
              }`}
            >
              {notif.message}
            </div>
          ))}
        </div>
      )}

      {/* Main Narrative & Game Center */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 flex-1 w-full">
        {/* Character HUD Stats Strip */}
        {Object.keys(gameState.stats).length > 0 && (
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {Object.entries(gameState.stats).map(([statKey, val]) => {
                const config = gameSpec.initialState?.stats?.[statKey];
                const max = config?.max || 100;
                const percentage = Math.min(100, Math.max(0, (val / max) * 100));

                return (
                  <div key={statKey} className="flex items-center gap-2">
                    {renderStatIcon(config?.icon)}
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-code uppercase tracking-wider text-slate-400">
                          {config?.label || statKey}
                        </span>
                        <span className="text-xs font-bold font-code text-slate-100">
                          {val}
                          {config?.unit ? ` ${config.unit}` : ''}
                        </span>
                      </div>
                      {/* Mini visual gauge bar for percentage stats */}
                      {max <= 100 && (
                        <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                          <div
                            className={`h-full transition-all duration-500 ${
                              val < 25 ? 'bg-rose-500' : val < 50 ? 'bg-amber-500' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scene Presentation Card */}
        <article className="p-6 sm:p-10 rounded-2xl bg-slate-900/70 border border-slate-800/90 backdrop-blur-md shadow-2xl space-y-6">
          {/* Chapter & Scene Title */}
          <div className="space-y-1 border-b border-slate-800/80 pb-4">
            <span className="text-[11px] font-code tracking-widest uppercase text-amber-400/90 font-semibold block">
              {currentNode.chapter || 'Scene'}
            </span>
            <h2 className="font-cinzel text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight leading-tight">
              {currentNode.title}
            </h2>
          </div>

          {/* Scene Illustration if present */}
          {currentNode.sceneImage && (
            <div className="relative aspect-[21/9] sm:aspect-[2.4/1] w-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
              <img
                src={currentNode.sceneImage}
                alt={currentNode.title}
                className="w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            </div>
          )}

          {/* Prose Narrative */}
          <div
            className={`text-slate-200 font-story leading-relaxed space-y-4 whitespace-pre-line ${
              fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'
            }`}
          >
            {currentNode.narrative}
          </div>

          {/* Dialogue Lines if present */}
          {currentNode.dialogue && currentNode.dialogue.length > 0 && (
            <div className="space-y-3 pt-2">
              {currentNode.dialogue.map((line, dIdx) => (
                <div
                  key={dIdx}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-amber-400 shrink-0">
                    {line.speaker.charAt(0)}
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-code font-bold text-amber-300">
                      {line.speaker}
                    </span>
                    <p className="text-sm font-story text-slate-200 italic">
                      "{line.text}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        {/* Ending Screen OR Branching Choices Section */}
        {currentNode.isEnding ? (
          /* ENDING CELEBRATION / SUMMARY SCREEN */
          <div className="p-6 sm:p-10 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-500/30 shadow-2xl text-center space-y-6">
            <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Trophy className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-code uppercase tracking-widest text-amber-400/90 font-bold block">
                Ending Reached // {currentNode.endingType?.toUpperCase() || 'FINALE'}
              </span>
              <h3 className="font-cinzel text-3xl sm:text-4xl font-black text-slate-100">
                {currentNode.endingTitle || currentNode.title}
              </h3>
              {currentNode.endingSummary && (
                <p className="text-sm text-slate-300 max-w-xl mx-auto font-story leading-relaxed">
                  {currentNode.endingSummary}
                </p>
              )}
            </div>

            {/* Journey Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-left">
              <div>
                <span className="text-[10px] font-code text-slate-400 uppercase">Choices Made</span>
                <p className="text-lg font-bold text-slate-100">{gameState.history.length - 1}</p>
              </div>
              <div>
                <span className="text-[10px] font-code text-slate-400 uppercase">Items Held</span>
                <p className="text-lg font-bold text-slate-100">{gameState.inventory.length}</p>
              </div>
              <div>
                <span className="text-[10px] font-code text-slate-400 uppercase">Achievements</span>
                <p className="text-lg font-bold text-amber-400">
                  {gameState.achievementsUnlocked.length}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-code text-slate-400 uppercase">Outcome Type</span>
                <p className="text-lg font-bold text-emerald-400 capitalize">
                  {currentNode.endingType || 'Completed'}
                </p>
              </div>
            </div>

            {/* Ending Actions */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={handleRestart}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Play from Beginning</span>
              </button>

              <button
                onClick={() => setIsHistoryDrawerOpen(true)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
              >
                <History className="w-4 h-4" />
                <span>Explore Other Branches</span>
              </button>

              <button
                onClick={handleShareEnding}
                className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-sm transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>Share Story</span>
              </button>
            </div>
          </div>
        ) : (
          /* BRANCHING DECISION CHOICES */
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-code uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Decide Your Path ({currentNode.choices?.length || 0})</span>
              </span>
            </div>

            <div className="space-y-3">
              {currentNode.choices?.map((choice, idx) => {
                const { canSelect, reason } = canSelectChoice(gameState, choice);

                return (
                  <button
                    key={choice.id || idx}
                    disabled={!canSelect}
                    onClick={() => handleChoiceClick(choice)}
                    className={`w-full group text-left p-4 sm:p-5 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                      canSelect
                        ? 'bg-slate-900/80 hover:bg-slate-850 hover:border-amber-500/60 border-slate-800 shadow-md hover:shadow-xl active:scale-[0.99] cursor-pointer'
                        : 'bg-slate-950/60 border-slate-900 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-code text-amber-400/80 font-bold">
                            [{idx + 1}]
                          </span>
                          <span className="text-sm sm:text-base font-bold text-slate-100 group-hover:text-amber-200 transition-colors">
                            {choice.text}
                          </span>
                        </div>

                        {/* Hint or Requirement Note */}
                        {choice.hint && (
                          <p className="text-xs text-slate-400 font-story pl-6 italic">
                            {choice.hint}
                          </p>
                        )}

                        {/* Lock Warning if conditions not met */}
                        {!canSelect && reason && (
                          <div className="flex items-center gap-1.5 pl-6 text-xs text-rose-400 font-code">
                            <Lock className="w-3.5 h-3.5" />
                            <span>{reason}</span>
                          </div>
                        )}
                      </div>

                      {/* Right Badges: Risk / Cost */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {choice.riskOutcome && (
                          <span className="flex items-center gap-1 text-[11px] font-code px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            <Dice5 className="w-3.5 h-3.5 text-purple-400" />
                            <span>{Math.round(choice.riskOutcome.chance * 100)}% Check</span>
                          </span>
                        )}

                        {choice.cost && (
                          <span className="text-[10px] font-code px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/20">
                            -{choice.cost.amount} {choice.cost.statKey.toUpperCase()}
                          </span>
                        )}

                        {canSelect && (
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all mt-1" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Interactive Dice Roll Check Modal */}
      {activeRoll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 text-center space-y-5 shadow-2xl">
            <div className="inline-flex p-3 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300">
              <Dice5 className="w-8 h-8 animate-spin-slow" />
            </div>

            <div className="space-y-1">
              <span className="text-xs font-code uppercase tracking-wider text-slate-400">
                {activeRoll.stat} Skill Check
              </span>
              <h3 className="font-cinzel text-xl font-bold text-slate-100">
                Roll of Destiny
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 font-code">
                <span>Success Threshold:</span>
                <span>{activeRoll.threshold}% or lower</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold font-code text-slate-200">
                <span>Result Rolled:</span>
                <span
                  className={activeRoll.success ? 'text-emerald-400 text-lg' : 'text-rose-400 text-lg'}
                >
                  {activeRoll.roll}%
                </span>
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border text-sm font-bold ${
                activeRoll.success
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
              }`}
            >
              {activeRoll.success ? '✓ CHECK PASSED!' : '✕ CHECK FAILED!'}
            </div>

            <button
              onClick={handleConfirmDiceRoll}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm tracking-wide transition-colors"
            >
              Continue Story
            </button>
          </div>
        </div>
      )}

      {/* Inventory Drawer Modal */}
      {isInventoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-400" />
                <span>Inventory & Relics ({gameState.inventory.length})</span>
              </h3>
              <button
                onClick={() => setIsInventoryOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-sm font-code"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {gameState.inventory.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">{item.name}</span>
                      {item.quantity && item.quantity > 1 && (
                        <span className="text-[10px] font-code px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                          x{item.quantity}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-story">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* History Timeline & Checkpoint Drawer */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between space-y-4 shadow-2xl overflow-y-auto">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-cinzel text-base font-bold text-slate-100 flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  <span>Story Journey Transcript</span>
                </h3>
                <button
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Review past decisions. You can rewind to any prior checkpoint to explore alternate branches.
              </p>

              {/* Timeline Steps */}
              <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                {gameState.history.map((step, sIdx) => {
                  const isCurrent = sIdx === gameState.history.length - 1;

                  return (
                    <div key={sIdx} className="relative pl-8 space-y-1">
                      <div
                        className={`absolute left-2 top-1.5 w-3 h-3 rounded-full border-2 transform -translate-x-1/2 ${
                          isCurrent
                            ? 'bg-amber-400 border-slate-900 ring-2 ring-amber-400/50'
                            : 'bg-slate-700 border-slate-900'
                        }`}
                      />

                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-bold text-slate-200">{step.nodeTitle}</span>
                        {!isCurrent && (
                          <button
                            onClick={() => handleRewind(sIdx)}
                            className="text-[10px] font-code text-amber-400 hover:underline"
                          >
                            Rewind to Here
                          </button>
                        )}
                      </div>

                      {step.chosenChoiceText && (
                        <p className="text-[11px] text-slate-400 font-story italic pl-2 border-l border-slate-800">
                          "{step.chosenChoiceText}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => setIsHistoryDrawerOpen(false)}
              className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200"
            >
              Close Timeline
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
