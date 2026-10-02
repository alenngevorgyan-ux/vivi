import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { CanonicalScenario, RuntimeAction } from '../../engine/runtime/RuntimeCompiler';
import { SceneArt } from '../../assets/worlds/SceneArt';
import { CharacterFigure } from '../../assets/characters/CharacterFigure';
import { resolveMovement } from '../../engine/runtime/collision';
import { computePhysicalModifiers, type PhysicalModifierState } from '../../engine/runtime/ModifierEngine';
import { worldTemplates } from '../../world/templates';
import { MobileVirtualJoystick } from './MobileVirtualJoystick';
import { Volume2, Footprints, AlertCircle } from 'lucide-react';
import type { CharacterPose, CharacterFacing } from '../../assets/characters/characters';
import { StoryBeatRunner } from '../../engine/runtime/StoryBeatRunner';
import { telemetry } from '../../engine/runtime/telemetry';

interface CanonicalViviEngineProps {
  scenario: CanonicalScenario;
  elapsedMs: number;
  beatRunner: StoryBeatRunner;
  selectedAction: RuntimeAction | null;
  onActionInspected: (action: RuntimeAction) => void;
  committed: boolean;
  revealed: boolean;
  isMuted?: boolean;
}

export const CanonicalViviEngine: React.FC<CanonicalViviEngineProps> = ({
  scenario,
  elapsedMs,
  beatRunner,
  selectedAction,
  onActionInspected,
  committed,
  revealed,
  isMuted = false,
}) => {
  const world = worldTemplates[scenario.world] || worldTemplates.apartment_night;

  // Player physical position in 0-100 percentage coordinates
  const [playerPos, setPlayerPos] = useState<[number, number]>(() => scenario.playerSpawn);
  const [playerFacing, setPlayerFacing] = useState<CharacterFacing>('front');
  const [playerPose, setPlayerPose] = useState<CharacterPose>('idle');
  const [isMoving, setIsMoving] = useState(false);

  // Proximity warning state when player tries to click from across the room
  const [tooFarNotice, setTooFarNotice] = useState<{ actionId: string; message: string } | null>(null);

  // Active keyboard inputs
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mobileDir = useRef<'up' | 'down' | 'left' | 'right' | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());

  // Physical modifier state (vibrations, doors, elevators, timers) - completely generic
  const physicalState: PhysicalModifierState = useMemo(() => {
    return computePhysicalModifiers(scenario.modifiers, elapsedMs, scenario.timerAnchor);
  }, [scenario.modifiers, elapsedMs, scenario.timerAnchor]);

  // Compute nearby active actions based on strict physical distance
  const nearbyAction = useMemo<RuntimeAction | null>(() => {
    if (committed) return null;
    for (const act of scenario.actions) {
      const dist = Math.hypot(act.slotInfo.anchorX - playerPos[0], act.slotInfo.anchorY - playerPos[1]);
      if (dist <= act.slotInfo.interactionRadius) {
        return act;
      }
    }
    return null;
  }, [scenario.actions, playerPos, committed]);

  // Handle interaction trigger ONLY when physically near
  const handleInspectNearAction = useCallback((actionToInspect: RuntimeAction) => {
    const dist = Math.hypot(actionToInspect.slotInfo.anchorX - playerPos[0], actionToInspect.slotInfo.anchorY - playerPos[1]);
    if (dist > actionToInspect.slotInfo.interactionRadius) {
      // Reject remote interaction
      setTooFarNotice({
        actionId: actionToInspect.id,
        message: 'Слишком далеко · Подойдите ближе, чтобы исследовать',
      });
      setTimeout(() => setTooFarNotice(null), 2200);
      return;
    }

    setTooFarNotice(null);
    onActionInspected(actionToInspect);
    beatRunner.onObjectInspected(actionToInspect.targetSlot, actionToInspect.id, actionToInspect.observation);
    telemetry.recordEvent('object_inspected', elapsedMs, { objectId: actionToInspect.id });

    if (actionToInspect.slotInfo.diegeticType === 'phone') {
      setPlayerPose('look_at_phone');
    } else {
      setPlayerPose('turn');
    }
  }, [playerPos, onActionInspected, beatRunner, elapsedMs]);

  // Frame-rate-independent continuous movement loop using delta time
  useEffect(() => {
    if (committed) {
      setIsMoving(false);
      setPlayerPose('idle');
      return;
    }

    let animId: number;
    // 32% of canvas width per second across all display refresh rates (60Hz, 120Hz, 144Hz)
    const speedPercentPerSecond = 32;
    lastFrameTimeRef.current = performance.now();

    const loop = (timestamp: number) => {
      const deltaSeconds = Math.min(0.05, (timestamp - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = timestamp;

      let dx = 0;
      let dy = 0;
      const keys = keysPressed.current;
      const m = mobileDir.current;

      if (keys['w'] || keys['W'] || keys['ArrowUp'] || m === 'up') dy -= 1;
      if (keys['s'] || keys['S'] || keys['ArrowDown'] || m === 'down') dy += 1;
      if (keys['a'] || keys['A'] || keys['ArrowLeft'] || m === 'left') dx -= 1;
      if (keys['d'] || keys['D'] || keys['ArrowRight'] || m === 'right') dx += 1;

      if (dx !== 0 && dy !== 0) {
        // Normalize diagonal vector
        dx *= 0.7071;
        dy *= 0.7071;
      }

      const activeMove = dx !== 0 || dy !== 0;
      setIsMoving(activeMove);

      if (activeMove) {
        // Set character facing & walking pose
        if (Math.abs(dx) > Math.abs(dy)) {
          setPlayerFacing(dx > 0 ? 'right' : 'left');
        } else {
          setPlayerFacing(dy > 0 ? 'front' : 'left');
        }
        setPlayerPose('walk');

        // Apply physical collision & sliding with delta-time displacement
        setPlayerPos(([curX, curY]) => {
          const step = speedPercentPerSecond * deltaSeconds;
          const [nextX, nextY] = resolveMovement(curX, curY, dx * step, dy * step, scenario.world);
          return [nextX, nextY];
        });
      } else {
        setPlayerPose(prev => (prev === 'walk' ? 'idle' : prev));
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [committed, scenario.world]);

  // Keyboard listeners (inspection via 'E' or Space when in proximity)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      keysPressed.current[e.key] = true;

      if ((e.key === 'e' || e.key === 'E' || e.key === ' ') && nearbyAction) {
        e.preventDefault();
        handleInspectNearAction(nearbyAction);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [nearbyAction, handleInspectNearAction]);

  // Physical NPC positioning
  const npcPosition = useMemo<[number, number]>(() => {
    if (physicalState.npcAction.x && physicalState.npcAction.y) {
      return [physicalState.npcAction.x, physicalState.npcAction.y];
    }
    if (scenario.world === 'hallway_night') return [83, 76];
    if (scenario.world === 'office_night') return [65, 72];
    if (scenario.world === 'neighborhood_sunset') return [78, 68];
    if (scenario.world === 'train_station') return [56, 70];
    return [76, 76];
  }, [physicalState.npcAction, scenario.world]);

  const beatState = beatRunner.getState();
  const npcPose = physicalState.npcAction.pose || (beatState.pressureTriggered ? 'turn' : 'wait');
  const selectedEnding = selectedAction ? scenario.endings[selectedAction.id] : '';

  return (
    <div className="vivi-stage-shell relative select-none">
      <div className="vivi-stage relative overflow-hidden" ref={stageRef}>
        {/* Background Vector Scene Art */}
        <SceneArt world={scenario.world} active={beatState.cueTriggered} />

        {/* Ambient Vignette */}
        <div className="vivi-stage-vignette" />

        {/* World Label Header */}
        <div className="vivi-stage-caption">
          <span>{world.label.toUpperCase()}</span>
          {physicalState.timeDisplay.text && (
            <span
              className={`px-2 py-0.5 rounded font-mono text-xs ${
                physicalState.timeDisplay.isExpiring
                  ? 'text-amber-400 bg-red-950/80 animate-pulse'
                  : 'text-slate-200 bg-slate-900/60'
              }`}
            >
              {physicalState.timeDisplay.text}
            </span>
          )}
        </div>

        {/* Wall-Mounted Elevator Indicator */}
        {scenario.world === 'hallway_night' && (
          <div className="absolute top-[28%] right-[17%] z-10 px-2 py-0.5 rounded bg-black/85 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold shadow-md">
            {physicalState.elevator.indicatorText || 'FL 1'}
          </div>
        )}

        {/* Physical Phone Object on coffee table / nightstand */}
        {(scenario.world === 'apartment_night' || scenario.world === 'bedroom_night') && (
          <div
            className={`absolute z-10 w-7 h-12 rounded-sm transition-all flex items-center justify-center ${
              physicalState.phone.isVibrating ? 'animate-vivi-phone-vibrate' : ''
            }`}
            style={{
              left: scenario.world === 'apartment_night' ? '54%' : '64%',
              top: scenario.world === 'apartment_night' ? '68%' : '67%',
              transform: 'translate(-50%, -50%)',
              background: '#1a1e24',
              border: physicalState.phone.isScreenLit ? '1.5px solid #f59e0b' : '1px solid #334155',
              boxShadow: physicalState.phone.isScreenLit
                ? '0 0 16px 4px rgba(245, 158, 11, 0.45)'
                : '0 2px 5px rgba(0,0,0,0.5)',
            }}
          >
            {/* Screen illumination */}
            <div
              className={`w-5 h-9 rounded-[1px] transition-colors ${
                physicalState.phone.isScreenLit ? 'bg-amber-100/90' : 'bg-slate-900'
              }`}
            />
          </div>
        )}

        {/* Physical Door Handle with visible mechanical jiggle (No debug text) */}
        {physicalState.door.state === 'handle_moving' && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: scenario.world === 'apartment_night' ? '76%' : '18%',
              top: scenario.world === 'apartment_night' ? '38%' : '56%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-5 h-1.5 bg-amber-400 rounded-full shadow-lg animate-vivi-handle-jiggle" />
          </div>
        )}

        {/* NPC Character */}
        {scenario.npc && (
          <div
            className="vivi-npc absolute pointer-events-none transition-all duration-700"
            style={{ left: `${npcPosition[0]}%`, top: `${npcPosition[1]}%` }}
          >
            <CharacterFigure
              id={scenario.npc.character}
              facing={playerPos[0] < npcPosition[0] ? 'left' : 'right'}
              pose={npcPose}
              size={92}
            />
            {physicalState.npcAction.speakingLine && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-slate-900/90 text-slate-100 font-serif text-xs whitespace-nowrap border border-slate-700 shadow">
                “{physicalState.npcAction.speakingLine}”
              </div>
            )}
          </div>
        )}

        {/* Player Character (Continuous physical movement with delta-time) */}
        <div
          className="vivi-player absolute pointer-events-none z-20"
          style={{ left: `${playerPos[0]}%`, top: `${playerPos[1]}%` }}
        >
          <CharacterFigure
            id={scenario.playerCharacter}
            facing={playerFacing}
            pose={playerPose}
            size={96}
          />
        </div>

        {/* Semantic Action Markers (Physical In-World Spots) */}
        {!committed && beatRunner.getState().cueTriggered && scenario.actions.map(action => {
          const isNearby = nearbyAction?.id === action.id;
          const isSelected = selectedAction?.id === action.id;
          const isUnlocked = beatRunner.isActionUnlocked(action.id);
          const hasNotice = tooFarNotice?.actionId === action.id;

          return (
            <div
              key={action.id}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${action.slotInfo.anchorX}%`, top: `${action.slotInfo.anchorY}%` }}
            >
              {/* Interaction button - Clickable ONLY when nearby */}
              <button
                type="button"
                onClick={() => handleInspectNearAction(action)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all shadow-md ${
                  isSelected
                    ? 'bg-amber-600 text-amber-50 ring-4 ring-amber-400/40 scale-105'
                    : isNearby
                    ? 'bg-stone-900/95 text-amber-200 border border-amber-400/80 ring-2 ring-amber-500/30 scale-105'
                    : isUnlocked
                    ? 'bg-stone-900/80 text-stone-200 border border-stone-600/60'
                    : 'bg-stone-900/60 text-stone-400 border border-stone-800/40 opacity-75'
                }`}
                title={isNearby ? `Исследовать: ${action.label}` : 'Подойдите ближе, чтобы исследовать'}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isSelected
                      ? 'bg-amber-200'
                      : isNearby
                      ? 'bg-amber-400 animate-ping'
                      : isUnlocked
                      ? 'bg-emerald-400'
                      : 'bg-stone-500'
                  }`}
                />
                <span className="font-sans font-medium text-[11px] whitespace-nowrap">{action.label}</span>
              </button>

              {/* In-World Proximity Action Prompt */}
              {isNearby && !isSelected && (
                <div className="mt-1 px-2 py-0.5 rounded bg-black/90 text-amber-300 font-mono text-[9px] tracking-wide uppercase border border-amber-400/50 animate-pulse pointer-events-none">
                  Нажмите [E] или коснитесь
                </div>
              )}

              {/* Distance Warning if clicked from across room */}
              {hasNotice && (
                <div className="mt-1 px-2 py-0.5 rounded bg-red-950/95 text-red-200 font-sans text-[10px] tracking-wide border border-red-500/60 shadow-lg animate-fade-in pointer-events-none flex items-center gap-1">
                  <AlertCircle size={10} />
                  <span>Подойдите ближе</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Commitment Freeze overlay */}
        {committed && (
          <div className="vivi-stage-freeze">
            <span>THE MOMENT AFTER</span>
            <p>{selectedEnding}</p>
          </div>
        )}
      </div>

      {/* Under-Stage Status Bar */}
      <div className="vivi-stage-under">
        <span>
          <Volume2 size={14} className="text-stone-400" />
          <span className="text-[10px] text-stone-400">Captions active · Spatial audio</span>
        </span>
        <span className="hidden sm:inline text-[10px] text-stone-400 font-mono tracking-wider flex items-center gap-1.5">
          <Footprints size={12} />
          ПЕРЕДВИЖЕНИЕ: [W, A, S, D] / СТРЕЛКИ · ИССЛЕДОВАНИЕ: [E] ВБЛИЗИ ОБЪЕКТА
        </span>
      </div>

      {/* Mobile Virtual Joystick */}
      {!committed && (
        <div className="block sm:hidden">
          <MobileVirtualJoystick
            onMove={(dir) => { mobileDir.current = dir; }}
            onInteract={() => { if (nearbyAction) handleInspectNearAction(nearbyAction); }}
            canInteract={!!nearbyAction}
            interactionLabel={nearbyAction ? 'Исследовать' : 'Идти'}
          />
        </div>
      )}
    </div>
  );
};
