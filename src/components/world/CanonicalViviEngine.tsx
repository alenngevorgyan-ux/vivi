import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { CanonicalScenario, RuntimeAction } from '../../engine/runtime/RuntimeCompiler';
import { SceneArt } from '../../assets/worlds/SceneArt';
import { CharacterFigure } from '../../assets/characters/CharacterFigure';
import { resolveMovement } from '../../engine/runtime/collision';
import { computePhysicalModifiers, type PhysicalModifierState } from '../../engine/runtime/ModifierEngine';
import { worldTemplates } from '../../world/templates';
import { MobileVirtualJoystick } from './MobileVirtualJoystick';
import { Volume2, VolumeX, Eye, ArrowRight } from 'lucide-react';
import type { CharacterPose, CharacterFacing } from '../../assets/characters/characters';

interface CanonicalViviEngineProps {
  scenario: CanonicalScenario;
  elapsedMs: number;
  selectedAction: RuntimeAction | null;
  onSelectAction: (action: RuntimeAction) => void;
  onCommit: (action: RuntimeAction) => void;
  committed: boolean;
  revealed: boolean;
  onObservation: (text: string) => void;
  isMuted?: boolean;
}

export const CanonicalViviEngine: React.FC<CanonicalViviEngineProps> = ({
  scenario,
  elapsedMs,
  selectedAction,
  onSelectAction,
  onCommit,
  committed,
  revealed,
  onObservation,
  isMuted = false,
}) => {
  const world = worldTemplates[scenario.world] || worldTemplates.apartment_night;

  // Player physical position in 0-100 percentage coordinates
  const [playerPos, setPlayerPos] = useState<[number, number]>(() => scenario.playerSpawn);
  const [playerFacing, setPlayerFacing] = useState<CharacterFacing>('front');
  const [playerPose, setPlayerPose] = useState<CharacterPose>('idle');
  const [isMoving, setIsMoving] = useState(false);

  // Active keyboard inputs
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mobileDir = useRef<'up' | 'down' | 'left' | 'right' | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Physical modifier state (vibrations, doors, elevators, timers)
  const physicalState: PhysicalModifierState = useMemo(() => {
    return computePhysicalModifiers(scenario.modifiers, elapsedMs, scenario.id);
  }, [scenario.modifiers, elapsedMs, scenario.id]);

  // Compute nearby active actions based on physical distance
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

  // Handle interaction trigger (E key or inspect button)
  const handleInspect = useCallback((actionToInspect: RuntimeAction) => {
    onSelectAction(actionToInspect);
    onObservation(actionToInspect.observation);
    if (actionToInspect.slotInfo.diegeticType === 'phone') {
      setPlayerPose('look_at_phone');
    } else {
      setPlayerPose('turn');
    }
  }, [onSelectAction, onObservation]);

  // 60FPS Continuous Movement Game Loop with real collision resolution
  useEffect(() => {
    if (committed) {
      setIsMoving(false);
      setPlayerPose('idle');
      return;
    }

    let animId: number;
    const moveSpeed = 0.55; // percentage per frame (~33% per second)

    const loop = () => {
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

        // Apply physical collision & sliding
        setPlayerPos(([curX, curY]) => {
          return resolveMovement(curX, curY, dx * moveSpeed, dy * moveSpeed, scenario.world);
        });
      } else {
        setPlayerPose(prev => (prev === 'walk' ? 'idle' : prev));
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [committed, scenario.world]);

  // Keyboard listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in reflection textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      keysPressed.current[e.key] = true;

      // 'E' or Space to inspect nearby action
      if ((e.key === 'e' || e.key === 'E' || e.key === ' ') && nearbyAction) {
        e.preventDefault();
        handleInspect(nearbyAction);
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
  }, [nearbyAction, handleInspect]);

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

  // NPC character pose
  const npcPose = physicalState.npcAction.pose || (elapsedMs >= 24000 ? 'turn' : 'wait');

  // Selected ending copy
  const selectedEnding = selectedAction ? scenario.endings[selectedAction.id] : '';

  return (
    <div className="vivi-stage-shell relative select-none">
      <div className="vivi-stage relative overflow-hidden" ref={stageRef}>
        {/* Background Vector Scene Art */}
        <SceneArt world={scenario.world} active={elapsedMs >= 6000} />

        {/* Ambient Vignette */}
        <div className="vivi-stage-vignette" />

        {/* World Label Header */}
        <div className="vivi-stage-caption">
          <span>{world.label.toUpperCase()}</span>
          {physicalState.timeDisplay.text && (
            <span className={`px-2 py-0.5 rounded font-mono text-xs ${physicalState.timeDisplay.isExpiring ? 'text-amber-400 bg-red-950/80 animate-pulse' : 'text-slate-200 bg-slate-900/60'}`}>
              {physicalState.timeDisplay.text}
            </span>
          )}
        </div>

        {/* Diegetic Elevator Indicator for hallway_night */}
        {scenario.world === 'hallway_night' && (
          <div className="absolute top-[28%] right-[17%] z-10 px-2 py-0.5 rounded bg-black/85 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold shadow-md">
            {physicalState.elevator.indicatorText || 'FL 1'}
          </div>
        )}

        {/* Diegetic Phone on table with physical vibrations and illuminated screen */}
        {scenario.world === 'apartment_night' && (
          <div
            className={`absolute z-10 transition-all ${physicalState.phone.isVibrating ? 'animate-bounce' : ''}`}
            style={{ left: '54%', top: '68%', transform: 'translate(-50%, -50%)' }}
          >
            {physicalState.phone.isScreenLit && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded bg-slate-950/90 border border-amber-400/50 text-amber-200 font-mono text-[11px] whitespace-nowrap shadow-lg animate-pulse">
                💬 {physicalState.phone.previewText}
              </div>
            )}
          </div>
        )}

        {/* Diegetic Door handle rattle animation */}
        {physicalState.door.state === 'handle_moving' && (
          <div
            className="absolute z-10 px-2 py-0.5 rounded bg-red-950/90 border border-red-500/50 text-red-200 font-mono text-[10px] animate-pulse"
            style={{
              left: scenario.world === 'apartment_night' ? '76%' : '18%',
              top: scenario.world === 'apartment_night' ? '38%' : '56%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            *HANDLE JIGGLES*
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

        {/* Player Character (Continuous physical movement) */}
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
        {!committed && elapsedMs >= 5000 && scenario.actions.map(action => {
          const isNearby = nearbyAction?.id === action.id;
          const isSelected = selectedAction?.id === action.id;

          return (
            <div
              key={action.id}
              className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
              style={{ left: `${action.slotInfo.anchorX}%`, top: `${action.slotInfo.anchorY}%` }}
            >
              {/* Interaction Hotspot Pulse */}
              <button
                type="button"
                onClick={() => handleInspect(action)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all shadow-md ${
                  isSelected
                    ? 'bg-amber-600 text-amber-50 ring-4 ring-amber-400/40 scale-105'
                    : isNearby
                    ? 'bg-stone-900/90 text-stone-100 border border-amber-500/60 ring-2 ring-amber-500/20'
                    : 'bg-stone-900/70 text-stone-300 border border-stone-700/50 hover:bg-stone-900/90'
                }`}
                title={action.label}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-amber-200' : isNearby ? 'bg-amber-400 animate-ping' : 'bg-stone-400'}`} />
                <span className="font-sans font-medium text-[11px] whitespace-nowrap">{action.label}</span>
              </button>

              {/* In-World Proximity Action Prompt */}
              {isNearby && !isSelected && (
                <div className="mt-1 px-2 py-0.5 rounded bg-black/85 text-amber-300 font-mono text-[9px] tracking-wide uppercase border border-amber-400/40 animate-pulse pointer-events-none">
                  Press [E] or Tap to Inspect
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
        <span className="hidden sm:inline text-[10px] text-stone-400 font-mono tracking-wider">
          MOVE: [W, A, S, D] / ARROWS · INSPECT: [E] / PROXIMITY
        </span>
      </div>

      {/* Mobile Virtual Joystick */}
      {!committed && (
        <div className="block sm:hidden">
          <MobileVirtualJoystick
            onMove={(dir) => { mobileDir.current = dir; }}
            onInteract={() => { if (nearbyAction) handleInspect(nearbyAction); }}
            canInteract={!!nearbyAction}
            interactionLabel={nearbyAction ? 'Inspect' : 'Explore'}
          />
        </div>
      )}
    </div>
  );
};
