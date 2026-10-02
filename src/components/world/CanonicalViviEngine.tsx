import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { CanonicalScenario, RuntimeAction } from '../../engine/runtime/RuntimeCompiler';
import {
  SceneBackdrop,
  SceneMidground,
  SceneForeground,
  SceneLighting,
  type SceneState,
} from '../../assets/worlds/SceneArt';
import { CharacterFigure } from '../../assets/characters/CharacterFigure';
import { resolveMovement } from '../../engine/runtime/collision';
import { computePhysicalModifiers, type PhysicalModifierState } from '../../engine/runtime/ModifierEngine';
import { worldTemplates } from '../../world/templates';
import { MobileVirtualJoystick } from './MobileVirtualJoystick';
import { Volume2 } from 'lucide-react';
import type { CharacterPose, CharacterFacing } from '../../assets/characters/characters';
import { StoryBeatRunner } from '../../engine/runtime/StoryBeatRunner';
import { telemetry } from '../../engine/runtime/telemetry';
import {
  buildCameraFrame,
  resolveShotTimeline,
  shotAt,
  type ViviCameraShot,
} from '../../engine/cinematic/cameraLanguage';
import { prefersReducedMotion } from '../../assets/characters/animationClock';
import { ambience } from '../../utils/viviAmbience';
import { stagePair } from '../../engine/cinematic/staging';

interface CanonicalViviEngineProps {
  scenario: CanonicalScenario;
  elapsedMs: number;
  beatRunner: StoryBeatRunner;
  selectedAction: RuntimeAction | null;
  onActionInspected: (action: RuntimeAction) => void;
  committed: boolean;
  revealed: boolean;
  isMuted?: boolean;
  /** Commitment happens in the world: the player acts where they are standing. */
  onCommit?: (action: RuntimeAction) => void;
  latestObservation?: string | null;
}

/** Control is only taken away for the opening beat; after that the player drives. */
const OPENING_LOCK_MS = 4200;
/** How long an inspection holds the lens on the object before releasing. */
const INSERT_HOLD_MS = 2300;
const STRIDE_SECONDS = 0.76;

/** Worlds whose phone prop is a physical object on a surface. */
const PHONE_SLOT: Partial<Record<string, string>> = {
  apartment_night: 'phone_table',
  bedroom_night: 'phone_screen',
};

export const CanonicalViviEngine: React.FC<CanonicalViviEngineProps> = ({
  scenario,
  elapsedMs,
  beatRunner,
  selectedAction,
  onActionInspected,
  committed,
  revealed,
  isMuted = false,
  onCommit,
  latestObservation,
}) => {
  const world = worldTemplates[scenario.world] || worldTemplates.apartment_night;
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  const [playerPos, setPlayerPos] = useState<[number, number]>(() => scenario.playerSpawn);
  const [playerFacing, setPlayerFacing] = useState<CharacterFacing>('front');
  const [playerPose, setPlayerPose] = useState<CharacterPose>('idle');
  const [walkPhase, setWalkPhase] = useState(0);
  const npcSpawn = useMemo<[number, number]>(() => {
    const slot = scenario.npc
      ? worldTemplates[scenario.world]?.slots.find(sl => sl.id === scenario.npc!.slot)
      : undefined;
    if (!slot) return stagePair(scenario.playerSpawn, 'normal_conversation', 'right').counterpart;
    // Partway along the line the partner will later walk, so the exit reads as travel.
    const t = 0.55;
    return [
      scenario.playerSpawn[0] + (slot.x - scenario.playerSpawn[0]) * t,
      Math.max(56, scenario.playerSpawn[1] + (slot.y + 14 - scenario.playerSpawn[1]) * t),
    ];
  }, [scenario.playerSpawn, scenario.npc, scenario.world]);
  const [npcPos, setNpcPos] = useState<[number, number]>(() => npcSpawn);
  const [npcFacing, setNpcFacing] = useState<CharacterFacing>('front');
  const [tooFarNotice, setTooFarNotice] = useState<string | null>(null);
  const [insertFocus, setInsertFocus] = useState<{ slot: string; atMs: number } | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mobileDir = useRef<'up' | 'down' | 'left' | 'right' | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const walkPhaseRef = useRef(0);
  const npcPosRef = useRef<[number, number]>(npcSpawn);
  const committableActionRef = useRef<RuntimeAction | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const physicalState: PhysicalModifierState = useMemo(
    () => computePhysicalModifiers(scenario.modifiers, elapsedMs, scenario.timerAnchor),
    [scenario.modifiers, elapsedMs, scenario.timerAnchor]
  );

  const beatState = beatRunner.getState();


  /* ----------------------------------------------------------- camera --- */

  const shotTimeline = useMemo(() => resolveShotTimeline(scenario.shots), [scenario.shots]);

  const activeShot = useMemo<{ shot: ViviCameraShot; slot?: string; locked: boolean }>(() => {
    if (revealed) return { shot: 'REALITY_HOLD', locked: true };
    if (committed) return { shot: 'FINAL_COMMIT', locked: true };

    // An inspection earns the only hard cut in the language.
    if (insertFocus && elapsedMs - insertFocus.atMs < INSERT_HOLD_MS) {
      return { shot: 'OBJECT_INSERT', slot: insertFocus.slot, locked: false };
    }

    const authored = shotAt(shotTimeline, elapsedMs);
    if (authored && elapsedMs < OPENING_LOCK_MS) {
      return { shot: authored.shot, slot: authored.slot, locked: authored.control === 'locked' };
    }
    if (authored) return { shot: authored.shot, slot: authored.slot, locked: false };

    if (beatState.pressureTriggered) return { shot: 'STATIC_TENSION', locked: false };
    return { shot: 'SOFT_FOLLOW', locked: false };
  }, [revealed, committed, insertFocus, elapsedMs, shotTimeline, beatState.pressureTriggered]);

  // A narrow stage shows less world at the same zoom, so the lens pulls back on it.
  const [stageWidth, setStageWidth] = useState(1000);
  useEffect(() => {
    const node = stageRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setStageWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Figures are drawn in pixels but live in a 1000-unit world, so their size has
  // to track the stage or a phone renders everyone three times life size.
  const figureSize = Math.max(44, Math.min(130, stageWidth * 0.098));

  const cameraFrame = useMemo(
    () =>
      buildCameraFrame(
        activeShot.shot,
        scenario.world,
        { player: playerPos, npc: scenario.npc ? npcPos : undefined },
        {
          slot: activeShot.slot,
          progress: 1,
          reducedMotion,
          zoomScale: stageWidth < 560 ? 0.78 : 1,
        }
      ),
    [activeShot, scenario.world, scenario.npc, playerPos, npcPos, reducedMotion, stageWidth]
  );

  const controlLocked = activeShot.locked || committed;

  /* ------------------------------------------------------- interaction --- */

  const nearbyAction = useMemo<RuntimeAction | null>(() => {
    if (committed) return null;
    let best: RuntimeAction | null = null;
    let bestDist = Infinity;
    for (const act of scenario.actions) {
      const dist = standingDistance(act, playerPos);
      if (dist <= act.slotInfo.interactionRadius && dist < bestDist) {
        best = act;
        bestDist = dist;
      }
    }
    return best;
  }, [scenario.actions, playerPos, committed]);

  const handleInspectNearAction = useCallback(
    (actionToInspect: RuntimeAction) => {
      const dist = standingDistance(actionToInspect, playerPos);
      if (dist > actionToInspect.slotInfo.interactionRadius) {
        setTooFarNotice('Слишком далеко');
        setTimeout(() => setTooFarNotice(null), 1800);
        return;
      }

      setTooFarNotice(null);
      onActionInspected(actionToInspect);
      beatRunner.onObjectInspected(
        actionToInspect.targetSlot,
        actionToInspect.id,
        actionToInspect.observation
      );
      telemetry.recordEvent('object_inspected', elapsedMs, { objectId: actionToInspect.id });
      setInsertFocus({ slot: actionToInspect.targetSlot, atMs: elapsedMs });
      setPlayerPose(actionToInspect.slotInfo.diegeticType === 'phone' ? 'look_at_phone' : 'turn');
    },
    [playerPos, onActionInspected, beatRunner, elapsedMs]
  );

  /* -------------------------------------------------------- movement --- */

  useEffect(() => {
    if (committed) {
      setPlayerPose('idle');
      return;
    }

    let animId: number;
    const speedPercentPerSecond = 32;
    lastFrameTimeRef.current = performance.now();

    const loop = (timestamp: number) => {
      const deltaSeconds = Math.min(0.05, (timestamp - lastFrameTimeRef.current) / 1000);
      lastFrameTimeRef.current = timestamp;

      let dx = 0;
      let dy = 0;
      if (!controlLocked) {
        const keys = keysPressed.current;
        const m = mobileDir.current;
        if (keys['w'] || keys['W'] || keys['ArrowUp'] || m === 'up') dy -= 1;
        if (keys['s'] || keys['S'] || keys['ArrowDown'] || m === 'down') dy += 1;
        if (keys['a'] || keys['A'] || keys['ArrowLeft'] || m === 'left') dx -= 1;
        if (keys['d'] || keys['D'] || keys['ArrowRight'] || m === 'right') dx += 1;
      }

      if (dx !== 0 && dy !== 0) {
        dx *= 0.7071;
        dy *= 0.7071;
      }

      if (dx !== 0 || dy !== 0) {
        // Horizontal intent wins the profile; otherwise the figure faces the camera or away.
        if (Math.abs(dx) > Math.abs(dy)) {
          setPlayerFacing(dx > 0 ? 'right' : 'left');
        } else {
          setPlayerFacing(dy > 0 ? 'front' : 'back');
        }
        setPlayerPose('walk');
        walkPhaseRef.current = (walkPhaseRef.current + deltaSeconds / STRIDE_SECONDS) % 1;
        setWalkPhase(walkPhaseRef.current);

        setPlayerPos(([curX, curY]) => {
          const step = speedPercentPerSecond * deltaSeconds;
          return resolveMovement(curX, curY, dx * step, dy * step, scenario.world);
        });
      } else {
        setPlayerPose(prev => (prev === 'walk' ? 'idle' : prev));
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [committed, scenario.world, controlLocked]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      keysPressed.current[e.key] = true;
      if (e.key === 'Enter' && committableActionRef.current) {
        e.preventDefault();
        onCommitRef.current?.(committableActionRef.current);
        return;
      }
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

  /* ------------------------------------------------------------- NPC --- */

  const npcTarget = useMemo<[number, number]>(() => {
    if (physicalState.npcAction.x !== undefined && physicalState.npcAction.y !== undefined) {
      return [physicalState.npcAction.x, physicalState.npcAction.y];
    }
    const slot = scenario.npc ? world.slots.find(s => s.id === scenario.npc!.slot) : undefined;
    if (slot) return [slot.x, slot.y];
    if (scenario.world === 'hallway_night') return [83, 76];
    if (scenario.world === 'office_night') return [65, 72];
    if (scenario.world === 'neighborhood_sunset') return [78, 68];
    if (scenario.world === 'train_station') return [56, 70];
    return [76, 76];
  }, [physicalState.npcAction, scenario.npc, scenario.world, world.slots]);

  // The partner walks to their mark instead of teleporting to it.
  const [npcWalking, setNpcWalking] = useState(false);
  const npcTargetRef = useRef<[number, number]>(npcTarget);
  npcTargetRef.current = npcTarget;

  useEffect(() => {
    if (!scenario.npc) return;
    let animId: number;
    let last = performance.now();
    const speed = 15;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const [cx, cy] = npcPosRef.current;
      const [tx, ty] = npcTargetRef.current;
      const dx = tx - cx;
      const dy = ty - cy;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.6) {
        const move = Math.min(dist, speed * dt);
        const next: [number, number] = [cx + (dx / dist) * move, cy + (dy / dist) * move];
        npcPosRef.current = next;
        setNpcPos(next);
        setNpcWalking(true);
        setNpcFacing(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back');
      } else {
        setNpcWalking(false);
      }
      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [scenario.npc]);

  // The doorway opens for a fixed beat once the partner starts leaving. Tying this
  // to their walk would hold the door open whenever animation frames are throttled.
  const leaveStartedAtRef = useRef<number | null>(null);
  if (physicalState.npcAction.pose === 'leave' && leaveStartedAtRef.current === null) {
    leaveStartedAtRef.current = elapsedMs;
  } else if (physicalState.npcAction.pose !== 'leave' && leaveStartedAtRef.current !== null) {
    leaveStartedAtRef.current = null;
  }
  const leaveStartedAt = leaveStartedAtRef.current;
  const doorOpenForEntry =
    leaveStartedAt !== null && elapsedMs - leaveStartedAt > 900 && elapsedMs - leaveStartedAt < 3200;

  const npcPose: CharacterPose = npcWalking
    ? 'walk'
    : physicalState.npcAction.pose || (beatState.pressureTriggered ? 'turn' : 'wait');

  // Once the partner has reached a doorway they are leaving through, they are gone:
  // the closed door, not a figure standing beside it, is what the player waits on.
  const npcHasExited =
    leaveStartedAt !== null &&
    elapsedMs - leaveStartedAt > 3200 &&
    physicalState.npcAction.pose === 'leave' &&
    physicalState.door.state !== 'open';

  /* ----------------------------------------------------------- sound --- */

  // Every sound here has a source in the room, so each one follows the physical
  // state rather than the narrative beat it happens to coincide with.
  useEffect(() => {
    ambience.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    ambience.setCue(physicalState.ambientAudioCue);
  }, [physicalState.ambientAudioCue]);

  useEffect(() => () => ambience.stop(), []);

  const wasVibratingRef = useRef(false);
  useEffect(() => {
    if (physicalState.phone.isVibrating && !wasVibratingRef.current) ambience.vibrate();
    wasVibratingRef.current = physicalState.phone.isVibrating;
  }, [physicalState.phone.isVibrating]);

  const lastDoorStateRef = useRef(physicalState.door.state);
  useEffect(() => {
    const prev = lastDoorStateRef.current;
    const next = physicalState.door.state;
    if (prev !== next && (next === 'open' || next === 'handle_moving')) {
      ambience.doorThump(next === 'handle_moving' ? 0.5 : 1);
    }
    lastDoorStateRef.current = next;
  }, [physicalState.door.state]);

  const wasDingingRef = useRef(false);
  useEffect(() => {
    if (physicalState.elevator.isDingActive && !wasDingingRef.current) ambience.ding();
    wasDingingRef.current = physicalState.elevator.isDingActive;
  }, [physicalState.elevator.isDingActive]);

  const lastIntercomRef = useRef<string | null>(null);
  useEffect(() => {
    if (physicalState.ambientAudioCue === 'intercom_ring' && lastIntercomRef.current !== 'intercom_ring') {
      ambience.intercom();
    }
    lastIntercomRef.current = physicalState.ambientAudioCue;
  }, [physicalState.ambientAudioCue]);

  /* ----------------------------------------------------------- scene --- */

  const sceneState: SceneState = {
    active: beatState.cueTriggered,
    doorState: doorOpenForEntry ? 'open' : physicalState.door.state,
    phoneLit: physicalState.phone.isScreenLit,
    elevatorText: physicalState.elevator.indicatorText,
    clockText: physicalState.timeDisplay.text,
    dim: beatState.pressureTriggered ? 0.25 : 0,
  };

  const phoneSlotId = PHONE_SLOT[scenario.world];
  const phoneSlot = phoneSlotId ? world.slots.find(s => s.id === phoneSlotId) : undefined;

  /** Figures and loose props, painted back to front so depth reads naturally. */
  const depthEntities = useMemo(() => {
    const items: Array<{ key: string; y: number; node: React.ReactNode }> = [];

    if (phoneSlot) {
      items.push({
        key: 'phone',
        y: phoneSlot.y - 4,
        node: (
          <div
            className={`vivi-prop-phone ${physicalState.phone.isVibrating ? 'is-vibrating' : ''}`}
            style={{ left: `${phoneSlot.x}%`, top: `${phoneSlot.y - 4}%` }}
          >
            <div className={`vivi-prop-phone-body ${physicalState.phone.isScreenLit ? 'is-lit' : ''}`}>
              <span className="vivi-prop-phone-screen" />
            </div>
            {physicalState.phone.isScreenLit && physicalState.phone.previewText && (
              <span className="vivi-prop-phone-text">{physicalState.phone.previewText}</span>
            )}
          </div>
        ),
      });
    }

    if (scenario.npc) {
      items.push({
        key: 'npc',
        y: npcPos[1],
        node: (
          <div
            className={`vivi-figure ${npcHasExited ? 'has-exited' : ''}`}
            style={{ left: `${npcPos[0]}%`, top: `${npcPos[1]}%`, '--depth': depthScale(npcPos[1]) } as React.CSSProperties}
          >
            <CharacterFigure id={scenario.npc.character} facing={npcFacing} pose={npcPose} size={figureSize} />
          </div>
        ),
      });
    }

    items.push({
      key: 'player',
      y: playerPos[1],
      node: (
        <div
          className="vivi-figure"
          style={{ left: `${playerPos[0]}%`, top: `${playerPos[1]}%`, '--depth': depthScale(playerPos[1]) } as React.CSSProperties}
        >
          <CharacterFigure
            id={scenario.playerCharacter}
            facing={playerFacing}
            pose={playerPose}
            size={figureSize}
            phase={playerPose === 'walk' ? walkPhase : undefined}
          />
        </div>
      ),
    });

    return items.sort((a, b) => a.y - b.y);
  }, [
    phoneSlot,
    physicalState.phone.isVibrating,
    physicalState.phone.isScreenLit,
    scenario.npc,
    scenario.playerCharacter,
    npcPos,
    npcFacing,
    npcPose,
    npcHasExited,
    playerPos,
    playerFacing,
    playerPose,
    walkPhase,
    figureSize,
  ]);

  const committableAction =
    nearbyAction && !committed && beatState.canCommit && beatRunner.isActionUnlocked(nearbyAction.id)
      ? nearbyAction
      : null;

  committableActionRef.current = committableAction;

  const showActionMarkers = !committed && beatState.cueTriggered;
  const selectedEnding = selectedAction ? scenario.endings[selectedAction.id] : '';
  const openingLine = elapsedMs < 5200 ? scenario.setup : null;

  return (
    <div className="vivi-stage-frame relative select-none">
      <div className="vivi-stage relative overflow-hidden" ref={stageRef}>
        <div
          className="vivi-world"
          style={{ transform: cameraFrame.transform, transition: cameraFrame.transition }}
        >
          <SceneBackdrop world={scenario.world} state={sceneState} />
          <SceneMidground world={scenario.world} state={sceneState} />

          <div className="vivi-depth">
            {depthEntities.map(entity => (
              <React.Fragment key={entity.key}>{entity.node}</React.Fragment>
            ))}

            {showActionMarkers &&
              scenario.actions.map(action => {
                const isNearby = nearbyAction?.id === action.id;
                const isSelected = selectedAction?.id === action.id;
                const isUnlocked = beatRunner.isActionUnlocked(action.id);
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleInspectNearAction(action)}
                    aria-label={action.label}
                    className={`vivi-spot ${isNearby ? 'is-near' : ''} ${isSelected ? 'is-selected' : ''} ${
                      isUnlocked ? 'is-known' : ''
                    }`}
                    style={{ left: `${action.slotInfo.anchorX}%`, top: `${action.slotInfo.anchorY}%` }}
                  >
                    <span className="vivi-spot-dot" />
                  </button>
                );
              })}
          </div>

          <SceneForeground world={scenario.world} state={sceneState} />
          <SceneLighting world={scenario.world} state={sceneState} />
        </div>

        {/* Interface lives outside the camera so it never scales with the lens. */}
        {physicalState.timeDisplay.text && physicalState.timeDisplay.isExpiring && (
          <div className="vivi-hud-time is-expiring">{physicalState.timeDisplay.text}</div>
        )}

        {openingLine && !committed && <p className="vivi-subtitle">{openingLine}</p>}

        {physicalState.npcAction.speakingLine && !committed && (
          <p className="vivi-subtitle vivi-subtitle-speech">«{physicalState.npcAction.speakingLine}»</p>
        )}



        {committableAction ? (
          <button
            type="button"
            className="vivi-commit-chip"
            onClick={() => onCommit?.(committableAction)}
          >
            <span className="vivi-prompt-key">⏎</span>
            {committableAction.commitLabel}
          </button>
        ) : (
          nearbyAction &&
          beatState.cueTriggered &&
          !committed && (
            <div className="vivi-prompt">
              <span className="vivi-prompt-key">E</span>
              {nearbyAction.label}
            </div>
          )
        )}

        {latestObservation && !committed && (
          <p className="vivi-subtitle vivi-subtitle-observation">{latestObservation}</p>
        )}

        {tooFarNotice && <div className="vivi-prompt vivi-prompt-warn">{tooFarNotice}</div>}

        {committed && (
          <div className="vivi-stage-freeze">
            <span>THE MOMENT AFTER</span>
            <p>{selectedEnding}</p>
          </div>
        )}
      </div>

      <div className="vivi-stage-under">
        <span>
          <Volume2 size={13} className="text-stone-400" />
          <span className="text-[10px] text-stone-400">{world.label}</span>
        </span>
        <span className="hidden sm:inline text-[10px] text-stone-500 font-mono tracking-wider">
          W A S D · E
        </span>
      </div>

      {!committed && (
        <div className="block sm:hidden">
          <MobileVirtualJoystick
            onMove={dir => {
              mobileDir.current = dir;
            }}
            onInteract={() => {
              if (nearbyAction) handleInspectNearAction(nearbyAction);
            }}
            canInteract={!!nearbyAction}
            interactionLabel={nearbyAction ? 'Исследовать' : 'Идти'}
          />
        </div>
      )}
    </div>
  );
};

/** Distance to the authored standing spot for an action. */
function standingDistance(action: RuntimeAction, pos: [number, number]): number {
  return Math.hypot(action.slotInfo.standX - pos[0], action.slotInfo.standY - pos[1]);
}

/** Figures further up the stage are further away, so they read slightly smaller. */
function depthScale(y: number): string {
  const t = Math.min(1, Math.max(0, (y - 46) / 48));
  return (0.86 + t * 0.22).toFixed(3);
}
