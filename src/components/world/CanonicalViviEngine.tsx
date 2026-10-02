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
import { resolveMovement, WORLD_COLLISIONS, type CollisionBox } from '../../engine/runtime/collision';
import { computePhysicalModifiers, type PhysicalModifierState } from '../../engine/runtime/ModifierEngine';
import { worldTemplates } from '../../world/templates';
import { MobileVirtualJoystick } from './MobileVirtualJoystick';
import { KeyObjectProp } from './KeyObjectProp';
import { Volume2 } from 'lucide-react';
import type { CharacterPose, CharacterFacing } from '../../assets/characters/characters';
import { StoryBeatRunner } from '../../engine/runtime/StoryBeatRunner';
import { telemetry } from '../../engine/runtime/telemetry';
import { buildCameraFrame, resolveShotTimeline } from '../../engine/cinematic/cameraLanguage';
import { directShot, OPENING_LOCK_MS, type DirectedShot } from '../../engine/cinematic/director';
import { prefersReducedMotion } from '../../assets/characters/animationClock';
import { ambience } from '../../utils/viviAmbience';
import { actorFramesAt, actorObstacle, type ActorFrame } from '../../engine/runtime/actors';
import { scenarioCast } from '../../engine/runtime/scenarioActors';
import { findPath } from '../../engine/runtime/navigation';

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
  /**
   * Director Lab: render the scene exactly as it is at one moment, with no
   * animation loop. Every actor, light and camera decision is a function of time.
   */
  frozen?: { atMs: number; playerPos?: [number, number]; insertSlot?: string };
  /** Director Lab: draw collision, slots, stand points and actor routes. */
  debug?: boolean;
  /** Director Lab: report what the director decided. */
  onDirected?: (shot: DirectedShot) => void;
}

/** World units per second at full walking pace. */
const PLAYER_SPEED = 27;
/** World units per full two-step cycle; the cycle is driven by distance so feet never skate. */
const PLAYER_STRIDE = 12.5;
/** Seconds to reach / lose walking pace. */
const ACCEL_TAU = 0.085;
const DECEL_TAU = 0.11;

export const CanonicalViviEngine: React.FC<CanonicalViviEngineProps> = ({
  scenario,
  elapsedMs: liveElapsedMs,
  beatRunner,
  selectedAction,
  onActionInspected,
  committed,
  revealed,
  isMuted = false,
  onCommit,
  latestObservation,
  frozen,
  debug = false,
  onDirected,
}) => {
  const elapsedMs = frozen ? frozen.atMs : liveElapsedMs;
  const world = worldTemplates[scenario.world] || worldTemplates.apartment_night;
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const cast = useMemo(() => scenarioCast(scenario), [scenario]);
  const cinematic = scenario.cinematic;

  const [playerPos, setPlayerPos] = useState<[number, number]>(() => frozen?.playerPos ?? scenario.playerSpawn);
  const [playerFacing, setPlayerFacing] = useState<CharacterFacing>('front');
  const [playerPose, setPlayerPose] = useState<CharacterPose>('idle');
  const [walkPhase, setWalkPhase] = useState(0);
  const [tooFarNotice, setTooFarNotice] = useState<string | null>(null);
  const [insertFocus, setInsertFocus] = useState<{ slot: string; atMs: number } | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const mobileDir = useRef<'up' | 'down' | 'left' | 'right' | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const committableActionRef = useRef<RuntimeAction | null>(null);
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const playerPosRef = useRef(playerPos);
  playerPosRef.current = playerPos;

  useEffect(() => {
    if (frozen?.playerPos) setPlayerPos(frozen.playerPos);
  }, [frozen?.playerPos?.[0], frozen?.playerPos?.[1]]);

  const physicalState: PhysicalModifierState = useMemo(
    () => computePhysicalModifiers(scenario.modifiers, elapsedMs, scenario.timerAnchor),
    [scenario.modifiers, elapsedMs, scenario.timerAnchor]
  );

  const beatState = beatRunner.getState();

  /* ----------------------------------------------------------- actors --- */

  const slotPoint = useCallback(
    (slot: string): [number, number] | undefined => {
      const s = world.slots.find(sl => sl.id === slot);
      return s ? [s.x, s.y] : undefined;
    },
    [world]
  );

  const actorCtx = useMemo(
    () => ({ world: scenario.world, obstacles: cast.staticObstacles, slotPoint }),
    [scenario.world, cast.staticObstacles, slotPoint]
  );

  const computeFrames = useCallback(
    (t: number, player: [number, number], stare: boolean) =>
      actorFramesAt(cast.actors, cast.cues, t, { ...actorCtx, playerPos: player, stare }),
    [cast, actorCtx]
  );

  const [actorFrames, setActorFrames] = useState<ActorFrame[]>(() =>
    computeFrames(elapsedMs, playerPos, physicalState.stare)
  );

  // Scene time arrives every 100 ms; actors interpolate between ticks so they glide.
  const clockRef = useRef({ ms: elapsedMs, at: typeof performance !== 'undefined' ? performance.now() : 0 });
  useEffect(() => {
    clockRef.current = { ms: elapsedMs, at: performance.now() };
  }, [elapsedMs]);
  const stareRef = useRef(physicalState.stare);
  stareRef.current = physicalState.stare;

  useEffect(() => {
    if (frozen) setActorFrames(computeFrames(frozen.atMs, frozen.playerPos ?? playerPosRef.current, physicalState.stare));
  }, [frozen?.atMs, frozen?.playerPos?.[0], frozen?.playerPos?.[1], computeFrames, physicalState.stare]);

  const framesById = useMemo(() => Object.fromEntries(actorFrames.map(f => [f.id, f])), [actorFrames]);
  const primaryActor = cast.actors.find(a => a.cls === 'primary');

  /* ----------------------------------------------------------- camera --- */

  const shotTimeline = useMemo(() => resolveShotTimeline(scenario.shots), [scenario.shots]);

  const commitAvailableAtRef = useRef<number | null>(null);
  if (beatState.canCommit && commitAvailableAtRef.current === null) commitAvailableAtRef.current = elapsedMs;

  const directed = useMemo<DirectedShot>(
    () =>
      directShot({
        elapsedMs,
        revealed,
        committed,
        pressureTriggered: beatState.pressureTriggered,
        insert: frozen?.insertSlot ? { slot: frozen.insertSlot, atMs: elapsedMs } : insertFocus,
        commitAvailableAt: commitAvailableAtRef.current,
        grammar: cinematic?.cameraGrammar,
        events: cinematic?.cameraEvents,
        focusSlot: cinematic?.focusSlot,
        authored: shotTimeline,
      }),
    [elapsedMs, revealed, committed, beatState.pressureTriggered, insertFocus, frozen?.insertSlot, cinematic, shotTimeline]
  );

  useEffect(() => {
    onDirected?.(directed);
  }, [directed.shot, directed.slot, directed.reason, onDirected]);

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

  const focusActorFrame =
    (directed.actor && framesById[directed.actor]) ||
    actorFrames.find(f => f.id === primaryActor?.id && f.presence > 0.5) ||
    actorFrames.find(f => f.presence > 0.5 && cast.actors.find(a => a.id === f.id)?.cls !== 'background');

  const pointForSlot = (slot?: string): [number, number] | undefined => {
    if (!slot) return undefined;
    if (slot === 'carried') return playerPos;
    if (slot.startsWith('actor:')) return framesById[slot.slice(6)]?.pos;
    return slotPoint(slot);
  };

  const cameraFrame = buildCameraFrame(
    directed.shot,
    scenario.world,
    { player: playerPos, npc: focusActorFrame?.pos },
    {
      slot: directed.slot,
      point: pointForSlot(directed.slot),
      progress: 1,
      reducedMotion: reducedMotion || !!frozen,
      zoomScale: stageWidth < 560 ? 0.78 : 1,
    }
  );

  const controlLocked = (directed.locked && elapsedMs < OPENING_LOCK_MS) || committed || !!frozen;

  /* ------------------------------------------------------- interaction --- */

  /** Where the player has to stand for an action right now. */
  const standFor = useCallback(
    (action: RuntimeAction): [number, number] => {
      if (action.slotInfo.carried) return playerPos;
      if (action.actorId && framesById[action.actorId]) return framesById[action.actorId].pos;
      return [action.slotInfo.standX, action.slotInfo.standY];
    },
    [framesById, playerPos]
  );

  const nearbyAction = useMemo<RuntimeAction | null>(() => {
    if (committed) return null;
    let best: RuntimeAction | null = null;
    let bestDist = Infinity;
    for (const act of scenario.actions) {
      if (act.slotInfo.carried) continue;
      const [sx, sy] = standFor(act);
      const dist = Math.hypot(sx - playerPos[0], sy - playerPos[1]);
      if (dist <= act.slotInfo.interactionRadius && dist < bestDist) {
        best = act;
        bestDist = dist;
      }
    }
    // Something in your own hand is always within reach, but a place in the room wins.
    return best ?? scenario.actions.find(a => a.slotInfo.carried) ?? null;
  }, [scenario.actions, playerPos, committed, standFor]);

  const labelFor = (action: RuntimeAction) => {
    if (action.actorId && action.awayLabel && (framesById[action.actorId]?.presence ?? 1) < 0.5) return action.awayLabel;
    return action.label;
  };

  const handleInspectNearAction = useCallback(
    (actionToInspect: RuntimeAction) => {
      const [sx, sy] = standFor(actionToInspect);
      const dist = actionToInspect.slotInfo.carried ? 0 : Math.hypot(sx - playerPos[0], sy - playerPos[1]);
      if (dist > actionToInspect.slotInfo.interactionRadius) {
        setTooFarNotice('Слишком далеко');
        setTimeout(() => setTooFarNotice(null), 1800);
        return;
      }

      setTooFarNotice(null);
      onActionInspected(actionToInspect);
      beatRunner.onObjectInspected(actionToInspect.targetSlot, actionToInspect.id, actionToInspect.observation);
      telemetry.recordEvent('object_inspected', elapsedMs, { objectId: actionToInspect.id });
      setInsertFocus({ slot: actionToInspect.targetSlot, atMs: elapsedMs });
      setPlayerPose(actionToInspect.slotInfo.diegeticType === 'phone' ? 'look_at_phone' : 'turn');
    },
    [playerPos, onActionInspected, beatRunner, elapsedMs, standFor]
  );

  /* ------------------------------------------------------------ loop --- */

  // One animation loop for the whole stage: player physics and actor interpolation.
  const velocityRef = useRef<[number, number]>([0, 0]);
  const walkPhaseRef = useRef(0);
  const lastFramesKeyRef = useRef('');
  const actorFramesRef = useRef(actorFrames);
  actorFramesRef.current = actorFrames;

  useEffect(() => {
    if (frozen) return;
    let animId: number;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      /* Actors are a pure function of time; only re-render when something visible changed. */
      const sceneT = clockRef.current.ms + Math.min(150, now - clockRef.current.at);
      if (cast.actors.length) {
        const frames = computeFrames(sceneT, playerPosRef.current, stareRef.current);
        const key = frames
          .map(f => `${f.pos[0].toFixed(2)},${f.pos[1].toFixed(2)},${f.pose},${f.facing},${f.presence.toFixed(2)},${(f.walkPhase ?? 0).toFixed(2)}`)
          .join('|');
        if (key !== lastFramesKeyRef.current) {
          lastFramesKeyRef.current = key;
          setActorFrames(frames);
        }
      }

      if (!committed) {
        let ix = 0;
        let iy = 0;
        if (!controlLocked) {
          const keys = keysPressed.current;
          const m = mobileDir.current;
          if (keys['w'] || keys['W'] || keys['ArrowUp'] || m === 'up') iy -= 1;
          if (keys['s'] || keys['S'] || keys['ArrowDown'] || m === 'down') iy += 1;
          if (keys['a'] || keys['A'] || keys['ArrowLeft'] || m === 'left') ix -= 1;
          if (keys['d'] || keys['D'] || keys['ArrowRight'] || m === 'right') ix += 1;
        }
        if (ix !== 0 && iy !== 0) {
          ix *= 0.7071;
          iy *= 0.7071;
        }
        const hasIntent = ix !== 0 || iy !== 0;
        const [vx, vy] = velocityRef.current;
        const tau = hasIntent ? ACCEL_TAU : DECEL_TAU;
        const k = Math.min(1, dt / tau);
        const nvx = vx + (ix * PLAYER_SPEED - vx) * k;
        const nvy = vy + (iy * PLAYER_SPEED - vy) * k;
        const speed = Math.hypot(nvx, nvy);
        velocityRef.current = speed < 0.4 && !hasIntent ? [0, 0] : [nvx, nvy];

        if (hasIntent) {
          if (Math.abs(ix) > Math.abs(iy)) setPlayerFacing(ix > 0 ? 'right' : 'left');
          else setPlayerFacing(iy > 0 ? 'front' : 'back');
        }

        if (speed >= 0.4) {
          // People in the room are solid: you walk around them, not through them.
          const people: CollisionBox[] = actorFramesRef.current
            .filter(f => f.presence > 0.5)
            .map(f => actorObstacle(f.id, f.pos, f.pose === 'sit'));
          const [cx, cy] = playerPosRef.current;
          const next = resolveMovement(cx, cy, nvx * dt, nvy * dt, scenario.world, 2.4, people);
          const moved = Math.hypot(next[0] - cx, next[1] - cy);
          if (moved > 1e-4) {
            playerPosRef.current = next;
            setPlayerPos(next);
            walkPhaseRef.current = (walkPhaseRef.current + moved / PLAYER_STRIDE) % 1;
            setWalkPhase(walkPhaseRef.current);
          }
          setPlayerPose(moved > 1e-3 && speed > 2 ? 'walk' : prev => (prev === 'walk' ? 'idle' : prev));
        } else {
          setPlayerPose(prev => (prev === 'walk' ? 'idle' : prev));
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [committed, scenario.world, controlLocked, frozen, cast.actors.length, computeFrames]);

  useEffect(() => {
    if (committed) setPlayerPose('idle');
  }, [committed]);

  useEffect(() => {
    if (frozen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      keysPressed.current[e.key] = true;
      if (e.key === 'Enter' && committableActionRef.current) {
        e.preventDefault();
        onCommitRef.current?.(committableActionRef.current);
        return;
      }
      if ((e.key === 'e' || e.key === 'E' || e.key === ' ') && nearbyAction && beatState.cueTriggered) {
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
  }, [nearbyAction, handleInspectNearAction, frozen, beatState.cueTriggered]);

  /* ----------------------------------------------------------- sound --- */

  // Every sound here has a source in the room, so each one follows the physical
  // state rather than the narrative beat it happens to coincide with.
  const audible = !frozen;
  useEffect(() => {
    ambience.setMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    if (audible) ambience.setRestraint(cinematic?.soundRestraint ?? 0);
  }, [audible, cinematic?.soundRestraint]);

  const bedCue = physicalState.bed !== undefined ? physicalState.bed : physicalState.ambientAudioCue;
  useEffect(() => {
    if (audible) ambience.setCue(bedCue ?? null, cinematic?.bed ?? 'room_tone');
  }, [audible, bedCue, cinematic?.bed]);

  useEffect(() => () => ambience.stop(), []);

  const wasVibratingRef = useRef(false);
  useEffect(() => {
    if (audible && physicalState.phone.isVibrating && !wasVibratingRef.current) ambience.vibrate();
    wasVibratingRef.current = physicalState.phone.isVibrating;
  }, [audible, physicalState.phone.isVibrating]);

  const lastDoorStateRef = useRef(physicalState.door.state);
  useEffect(() => {
    const prev = lastDoorStateRef.current;
    const next = physicalState.door.state;
    if (audible && prev !== next && (next === 'open' || next === 'handle_moving' || next === 'closed')) {
      ambience.doorThump(next === 'handle_moving' ? 0.5 : next === 'closed' ? 0.7 : 1);
    }
    lastDoorStateRef.current = next;
  }, [audible, physicalState.door.state]);

  const wasDingingRef = useRef(false);
  useEffect(() => {
    if (audible && physicalState.elevator.isDingActive && !wasDingingRef.current) ambience.ding();
    wasDingingRef.current = physicalState.elevator.isDingActive;
  }, [audible, physicalState.elevator.isDingActive]);

  const lastIntercomRef = useRef<string | null>(null);
  useEffect(() => {
    if (audible && physicalState.ambientAudioCue === 'intercom_ring' && lastIntercomRef.current !== 'intercom_ring') {
      ambience.intercom();
    }
    lastIntercomRef.current = physicalState.ambientAudioCue;
  }, [audible, physicalState.ambientAudioCue]);

  const firedOneShotsRef = useRef(new Set<string>());
  useEffect(() => {
    if (!audible) return;
    for (const m of physicalState.activeModifiers) {
      const shot = m.data?.oneShot;
      if (!shot || firedOneShotsRef.current.has(m.id)) continue;
      firedOneShotsRef.current.add(m.id);
      if (shot === 'knock') ambience.knock();
      else ambience.footsteps();
    }
  }, [audible, physicalState.activeModifiers]);

  /* ----------------------------------------------------------- scene --- */

  const sceneState: SceneState = {
    active: beatState.cueTriggered,
    doorState: physicalState.door.state,
    phoneLit: physicalState.phone.isScreenLit,
    elevatorText: physicalState.elevator.indicatorText,
    elevatorOpen: physicalState.elevator.doorsOpen && !!physicalState.elevator.indicatorText,
    vehicleIn: physicalState.elevator.doorsOpen && !physicalState.elevator.indicatorText,
    clockText: physicalState.timeDisplay.text,
    dim: beatState.pressureTriggered ? 0.25 : 0,
  };

  const grade = cinematic?.lightingDef;
  const lightMode = physicalState.lightMode;
  const gradeDarkness =
    (grade?.darkness ?? 0) +
    (beatState.pressureTriggered ? grade?.pressureDim ?? 0 : 0) +
    (lightMode === 'dim' ? 0.18 : lightMode === 'out' ? 0.45 : 0);

  const carriedPhone = scenario.actions.some(a => a.slotInfo.carried && a.slotInfo.diegeticType === 'phone');

  /** Figures and loose props, painted back to front so depth reads naturally. */
  const depthEntities: Array<{ key: string; y: number; node: React.ReactNode }> = [];

  for (const obj of cast.keyObjects) {
    if (!obj.prop) continue;
    const isPhone = obj.kind === 'phone';
    const glinting = physicalState.glintSlots.includes(obj.slot);
    const active = isPhone
      ? physicalState.phone.isScreenLit || glinting
      : glinting || (obj.activeAtMs !== undefined && elapsedMs >= obj.activeAtMs && elapsedMs < obj.activeAtMs + 6000);
    depthEntities.push({
      key: `obj-${obj.id}`,
      y: obj.pos[1] - 4,
      node: (
        <KeyObjectProp
          kind={obj.kind}
          x={obj.pos[0]}
          y={obj.pos[1]}
          active={active}
          vibrating={isPhone && physicalState.phone.isVibrating}
          screenText={isPhone ? physicalState.phone.previewText : undefined}
          scale={figureSize}
        />
      ),
    });
  }

  for (const frame of actorFrames) {
    const actor = cast.actors.find(a => a.id === frame.id);
    if (!actor || frame.presence <= 0.001) continue;
    depthEntities.push({
      key: `actor-${frame.id}`,
      y: frame.pos[1],
      node: (
        <div
          className={`vivi-figure ${actor.cls === 'background' ? 'is-background' : ''}`}
          style={
            {
              left: `${frame.pos[0]}%`,
              top: `${frame.pos[1]}%`,
              '--depth': depthScale(frame.pos[1]),
              opacity: frame.presence,
            } as React.CSSProperties
          }
        >
          {frame.pose === 'sit' && <SeatGlyph size={figureSize} />}
          <CharacterFigure id={actor.character} facing={frame.facing} pose={frame.pose} size={figureSize} phase={frame.walkPhase} />
        </div>
      ),
    });
  }

  depthEntities.push({
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
        {carriedPhone && physicalState.phone.isScreenLit && (
          <span className={`vivi-carried-phone ${physicalState.phone.isVibrating ? 'is-vibrating' : ''}`}>
            {physicalState.phone.previewText}
          </span>
        )}
      </div>
    ),
  });

  depthEntities.sort((a, b) => a.y - b.y);

  const committableAction =
    nearbyAction && !committed && beatState.canCommit && beatRunner.isActionUnlocked(nearbyAction.id) ? nearbyAction : null;

  committableActionRef.current = committableAction;

  const showActionMarkers = !committed && beatState.cueTriggered;
  const selectedEnding = selectedAction ? scenario.endings[selectedAction.id] : '';
  const openingLine = elapsedMs < 5200 ? scenario.setup : null;

  return (
    <div className="vivi-stage-frame relative select-none">
      <div
        className="vivi-stage relative overflow-hidden"
        ref={stageRef}
        data-elapsed={Math.round(elapsedMs)}
        data-shot={directed.shot}
        data-shot-reason={directed.reason}
      >
        <div className="vivi-world" style={{ transform: cameraFrame.transform, transition: cameraFrame.transition }}>
          <SceneBackdrop world={scenario.world} state={sceneState} />
          <SceneMidground world={scenario.world} state={sceneState} />

          <div className="vivi-depth">
            {depthEntities.map(entity => (
              <React.Fragment key={entity.key}>{entity.node}</React.Fragment>
            ))}

            {showActionMarkers &&
              scenario.actions.map(action => {
                if (action.slotInfo.carried) return null;
                const isNearby = nearbyAction?.id === action.id;
                const isSelected = selectedAction?.id === action.id;
                const isUnlocked = beatRunner.isActionUnlocked(action.id);
                const actorFrame = action.actorId ? framesById[action.actorId] : undefined;
                if (actorFrame && actorFrame.presence < 0.5 && !action.awayLabel) return null;
                const [mx, my] = actorFrame
                  ? [actorFrame.pos[0], actorFrame.presence < 0.5 ? actorFrame.pos[1] - 8 : actorFrame.pos[1] - 15]
                  : [action.slotInfo.anchorX, action.slotInfo.anchorY];
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => handleInspectNearAction(action)}
                    aria-label={labelFor(action)}
                    className={`vivi-spot ${isNearby ? 'is-near' : ''} ${isSelected ? 'is-selected' : ''} ${isUnlocked ? 'is-known' : ''}`}
                    style={{ left: `${mx}%`, top: `${my}%` }}
                  >
                    <span className="vivi-spot-dot" />
                  </button>
                );
              })}
          </div>

          <SceneForeground world={scenario.world} state={sceneState} />
          <SceneLighting world={scenario.world} state={sceneState} />
          {debug && <DebugOverlay scenario={scenario} frames={actorFrames} playerPos={playerPos} />}
        </div>

        {/* Grade sits outside the lens: it is the light in the room, not a thing in it. */}
        {grade && (
          <div className={`vivi-grade ${lightMode === 'flicker' ? 'is-flicker' : ''}`} aria-hidden="true">
            <div className="vivi-grade-tint" style={{ background: grade.tint, opacity: grade.tintStrength }} />
            <div className="vivi-grade-dark" style={{ opacity: Math.min(0.75, gradeDarkness) }} />
            <div className="vivi-grade-vignette" style={{ opacity: grade.vignette }} />
          </div>
        )}

        {/* Interface lives outside the camera so it never scales with the lens. */}
        {physicalState.timeDisplay.text && physicalState.timeDisplay.isExpiring && (
          <div className="vivi-hud-time is-expiring">{physicalState.timeDisplay.text}</div>
        )}

        {openingLine && !committed && <p className="vivi-subtitle">{openingLine}</p>}

        {physicalState.npcAction.speakingLine && !committed && (
          <p className="vivi-subtitle vivi-subtitle-speech">«{physicalState.npcAction.speakingLine}»</p>
        )}

        {committableAction ? (
          <button type="button" className="vivi-commit-chip" onClick={() => onCommit?.(committableAction)}>
            <span className="vivi-prompt-key">⏎</span>
            {committableAction.commitLabel}
          </button>
        ) : (
          nearbyAction &&
          beatState.cueTriggered &&
          !committed && (
            <div className="vivi-prompt">
              <span className="vivi-prompt-key">E</span>
              {labelFor(nearbyAction)}
            </div>
          )
        )}

        {latestObservation && !committed && <p className="vivi-subtitle vivi-subtitle-observation">{latestObservation}</p>}

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
        <span className="hidden sm:inline text-[10px] text-stone-500 font-mono tracking-wider">W A S D · E</span>
      </div>

      {!committed && !frozen && (
        <div className="block sm:hidden">
          <MobileVirtualJoystick
            onMove={dir => {
              mobileDir.current = dir;
            }}
            onInteract={() => {
              if (nearbyAction && beatState.cueTriggered) handleInspectNearAction(nearbyAction);
            }}
            canInteract={!!nearbyAction && beatState.cueTriggered}
            interactionLabel={nearbyAction ? 'Исследовать' : 'Идти'}
          />
        </div>
      )}
    </div>
  );
};

/** A plain chair under a seated figure, drawn in the figure's own 0–100 box. */
function SeatGlyph({ size }: { size: number }) {
  return (
    <svg className="vivi-seat" width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="30" y="68" width="40" height="6" rx="1.5" fill="#24323a" />
      <path d="M34 74 L32 99 M66 74 L68 99" stroke="#1b262d" strokeWidth="3.4" />
      <path d="M50 74 V92 M42 99 H58" stroke="#1b262d" strokeWidth="2.6" />
    </svg>
  );
}

/** Figures further up the stage are further away, so they read slightly smaller. */
function depthScale(y: number): string {
  const t = Math.min(1, Math.max(0, (y - 46) / 48));
  return (0.86 + t * 0.22).toFixed(3);
}

/** Director Lab only: collision, standing spots and every actor's route. */
function DebugOverlay({
  scenario,
  frames,
  playerPos,
}: {
  scenario: CanonicalScenario;
  frames: ActorFrame[];
  playerPos: [number, number];
}) {
  const cast = scenarioCast(scenario);
  const config = WORLD_COLLISIONS[scenario.world];
  const routes = cast.cues
    .filter(c => (c.act === 'walk_to' || c.act === 'exit' || c.act === 'enter') && (c.to || c.then))
    .map((c, i) => {
      const actor = cast.actors.find(a => a.id === c.actor);
      const from = c.act === 'enter' ? c.to! : actor?.spawn ?? [50, 70];
      const to = c.act === 'enter' ? c.then ?? c.to! : c.to!;
      return { key: `${c.actor}-${i}`, path: findPath(scenario.world, from as [number, number], to, { extra: cast.staticObstacles, via: c.via }) };
    });
  const b = config.bounds;
  return (
    <svg className="vivi-debug" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect x={b.minX} y={b.minY} width={b.maxX - b.minX} height={b.maxY - b.minY} fill="none" stroke="#7cf" strokeWidth="0.25" strokeDasharray="1 0.6" />
      {[...config.obstacles, ...cast.staticObstacles].map(o => (
        <rect key={o.id} x={o.x1} y={o.y1} width={o.x2 - o.x1} height={o.y2 - o.y1} fill="rgba(255,80,80,.18)" stroke="#f66" strokeWidth="0.2" />
      ))}
      {routes.map(r => (
        <polyline key={r.key} points={r.path.map(p => p.join(',')).join(' ')} fill="none" stroke="#ffd36b" strokeWidth="0.35" />
      ))}
      {scenario.actions.map(a => (
        <g key={a.id}>
          <line x1={a.slotInfo.anchorX} y1={a.slotInfo.anchorY} x2={a.slotInfo.standX} y2={a.slotInfo.standY} stroke="#9f9" strokeWidth="0.15" />
          <circle cx={a.slotInfo.standX} cy={a.slotInfo.standY} r="0.8" fill="#9f9" />
        </g>
      ))}
      {frames.map(f => (
        <circle key={f.id} cx={f.pos[0]} cy={f.pos[1]} r="0.9" fill="#fc6" />
      ))}
      <circle cx={playerPos[0]} cy={playerPos[1]} r="1" fill="#6cf" />
    </svg>
  );
}
