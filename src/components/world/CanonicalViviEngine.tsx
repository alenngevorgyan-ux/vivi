import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { CanonicalScenario } from '../../engine/runtime/RuntimeCompiler';
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
import { KeyObjectProp } from './KeyObjectProp';
import type { CharacterPose, CharacterFacing } from '../../assets/characters/characters';
import { buildCameraFrame, resolveShotTimeline, type ViviCameraShot } from '../../engine/cinematic/cameraLanguage';
import { directShot, OPENING_LOCK_MS, type DirectedShot } from '../../engine/cinematic/director';
import { prefersReducedMotion } from '../../assets/characters/animationClock';
import { ambience } from '../../utils/viviAmbience';
import { actorFramesAt, actorObstacle, facingToward, type ActorFrame } from '../../engine/runtime/actors';
import { scenarioCast } from '../../engine/runtime/scenarioActors';
import { findPath, type Point } from '../../engine/runtime/navigation';
import type { ExperienceV2 } from '../../engine/experience/types';
import type { Phase } from '../../engine/experience/machine';
import { buildHotspots, intentById, type Hotspot } from '../../engine/experience/hotspots';
import { resolveApproach, type ResolutionMode } from '../../engine/experience/interaction';
import { performanceMs, recipeFor } from '../../engine/experience/enactment';
import { experienceFor } from '../../engine/experience/playback';
import { worldTemplates } from '../../world/templates';
import { WORLD_KNOWLEDGE } from '../../engine/compiler/worldKnowledge';

/** The player asked the hero to go somewhere for an intent. */
export interface MoveRequest {
  nonce: number;
  intentId: string;
  kind: 'look' | 'deed';
}

export interface ApproachDiagnostic {
  intentId: string;
  mode: ResolutionMode;
  diagnostics: string[];
}

interface CanonicalViviEngineProps {
  scenario: CanonicalScenario;
  /** Situation layer; derived through the legacy adapter when omitted. */
  experience?: ExperienceV2;
  elapsedMs: number;
  /** Once a deed is committed the world holds still: nobody else moves, speaks or arrives. */
  worldFrozenAtMs?: number | null;
  phase?: Phase;
  selectedKey?: string | null;
  move?: MoveRequest | null;
  onSelectHotspot?: (key: string) => void;
  onHotspotsChange?: (hotspots: Hotspot[]) => void;
  onArrived?: (intentId: string, mode: ResolutionMode) => void;
  onEnacted?: () => void;
  onApproachStarted?: (d: ApproachDiagnostic) => void;
  /** The player walked on their own (keys or a tap on the floor) during an approach. */
  onManualMove?: () => void;
  revealed?: boolean;
  isMuted?: boolean;
  reducedMotion?: boolean;
  /** Interface drawn over the stage (dock, subtitles), outside the camera. */
  children?: React.ReactNode;
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
/** Walking on the hero's behalf is a touch calmer than walking yourself. */
const AUTOPILOT_SPEED = 24;
/** World units per full two-step cycle; the cycle is driven by distance so feet never skate. */
const PLAYER_STRIDE = 12.5;
const ACCEL_TAU = 0.085;
const DECEL_TAU = 0.11;
const CUT_MS = 320;
const LEAD_MS = 700;

interface Autopilot {
  intentId?: string;
  kind?: 'look' | 'deed';
  mode: ResolutionMode;
  path: Point[];
  leg: number;
  face: Point;
  startedAt: number;
  /** A deed is being performed once the hero arrives. */
  perform?: { startedAt?: number; lead?: CharacterPose; gesture: CharacterPose; holdMs: number; exits?: boolean; exitTo?: Point };
}

export const CanonicalViviEngine: React.FC<CanonicalViviEngineProps> = ({
  scenario,
  experience: experienceProp,
  elapsedMs: liveElapsedMs,
  worldFrozenAtMs = null,
  phase = 'exploring',
  selectedKey = null,
  move = null,
  onSelectHotspot,
  onHotspotsChange,
  onArrived,
  onEnacted,
  onApproachStarted,
  onManualMove,
  revealed = false,
  isMuted = false,
  reducedMotion: reducedMotionProp,
  children,
  frozen,
  debug = false,
  onDirected,
}) => {
  const elapsedMs = frozen ? frozen.atMs : liveElapsedMs;
  const worldMs = worldFrozenAtMs != null ? Math.min(elapsedMs, worldFrozenAtMs) : elapsedMs;
  const reducedMotion = useMemo(() => reducedMotionProp ?? prefersReducedMotion(), [reducedMotionProp]);
  const experience = useMemo(() => experienceProp ?? experienceFor(scenario), [experienceProp, scenario]);
  const cast = useMemo(() => scenarioCast(scenario), [scenario]);
  const cinematic = scenario.cinematic;
  const committed = phase === 'enacting' || phase === 'pausing' || phase === 'boundary' || phase === 'revealed';
  const interactive = !frozen && (phase === 'exploring' || phase === 'approaching' || phase === 'observing');

  const [playerPos, setPlayerPos] = useState<Point>(() => frozen?.playerPos ?? scenario.playerSpawn);
  const [playerFacing, setPlayerFacing] = useState<CharacterFacing>('front');
  const [playerPose, setPlayerPose] = useState<CharacterPose>('idle');
  const [playerPresence, setPlayerPresence] = useState(1);
  const [walkPhase, setWalkPhase] = useState(0);
  const [cutting, setCutting] = useState(false);
  /** What the lens is attending to between events: a look, a deed. */
  const [attention, setAttention] = useState<{ shot: ViviCameraShot; point?: Point; actor?: string; atMs: number } | null>(null);

  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const stageRef = useRef<HTMLDivElement>(null);
  const playerPosRef = useRef(playerPos);
  playerPosRef.current = playerPos;
  const autopilotRef = useRef<Autopilot | null>(null);
  const callbacks = useRef({ onArrived, onEnacted, onManualMove });
  callbacks.current = { onArrived, onEnacted, onManualMove };

  useEffect(() => {
    if (frozen?.playerPos) setPlayerPos(frozen.playerPos);
  }, [frozen?.playerPos?.[0], frozen?.playerPos?.[1]]);

  const physicalState: PhysicalModifierState = useMemo(
    () => computePhysicalModifiers(scenario.modifiers, worldMs, scenario.timerAnchor),
    [scenario.modifiers, worldMs, scenario.timerAnchor]
  );

  /* ----------------------------------------------------------- actors --- */

  const world = scenario.world;
  const slotPoint = useCallback(
    (slot: string): Point | undefined => {
      const s = WORLD_SLOTS(world).find(sl => sl.id === slot);
      return s ? [s.x, s.y] : undefined;
    },
    [world]
  );

  const actorCtx = useMemo(() => ({ world, obstacles: cast.staticObstacles, slotPoint }), [world, cast.staticObstacles, slotPoint]);

  const computeFrames = useCallback(
    (t: number, player: Point, stare: boolean) => actorFramesAt(cast.actors, cast.cues, t, { ...actorCtx, playerPos: player, stare }),
    [cast, actorCtx]
  );

  const [actorFrames, setActorFrames] = useState<ActorFrame[]>(() => computeFrames(worldMs, playerPos, physicalState.stare));
  const clockRef = useRef({ ms: worldMs, at: typeof performance !== 'undefined' ? performance.now() : 0, frozen: worldFrozenAtMs != null });
  useEffect(() => {
    clockRef.current = { ms: worldMs, at: performance.now(), frozen: worldFrozenAtMs != null };
  }, [worldMs, worldFrozenAtMs]);
  const stareRef = useRef(physicalState.stare);
  stareRef.current = physicalState.stare;

  useEffect(() => {
    if (frozen) setActorFrames(computeFrames(frozen.atMs, frozen.playerPos ?? playerPosRef.current, physicalState.stare));
  }, [frozen?.atMs, frozen?.playerPos?.[0], frozen?.playerPos?.[1], computeFrames, physicalState.stare]);

  const framesById = useMemo(() => Object.fromEntries(actorFrames.map(f => [f.id, f])), [actorFrames]);
  const primaryActor = cast.actors.find(a => a.cls === 'primary');

  /* --------------------------------------------------------- hotspots --- */

  const hotspots = useMemo(
    () => buildHotspots({ scenario, experience, playerPos, frames: framesById, slotPoint }),
    [scenario, experience, playerPos, framesById, slotPoint]
  );
  const hotspotSignature = hotspots.map(h => `${h.key}:${h.throughDoor ? 'd' : ''}:${h.intents.map(i => i.id).join(',')}`).join('|');
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;
  useEffect(() => {
    onHotspotsChange?.(hotspotsRef.current);
  }, [hotspotSignature, onHotspotsChange]);

  /* ----------------------------------------------------------- camera --- */

  const shotTimeline = useMemo(() => resolveShotTimeline(scenario.shots), [scenario.shots]);
  const commitAvailableAtRef = useRef<number | null>(null);
  if (phase !== 'orienting' && commitAvailableAtRef.current === null) commitAvailableAtRef.current = elapsedMs;

  const directed = useMemo<DirectedShot>(() => {
    if (!frozen && attention && (committed || elapsedMs - attention.atMs < 4200)) {
      return { shot: attention.shot, locked: false, reason: committed ? 'deed' : 'look', ...(attention.actor ? { actor: attention.actor } : {}) };
    }
    return directShot({
      elapsedMs: worldMs,
      revealed,
      committed: committed && !attention,
      pressureTriggered: physicalState.timeDisplay.isExpiring,
      insert: frozen?.insertSlot ? { slot: frozen.insertSlot, atMs: elapsedMs } : null,
      commitAvailableAt: commitAvailableAtRef.current,
      grammar: cinematic?.cameraGrammar,
      events: cinematic?.cameraEvents,
      focusSlot: cinematic?.focusSlot,
      authored: shotTimeline,
    });
  }, [attention, committed, elapsedMs, worldMs, revealed, frozen?.insertSlot, cinematic, shotTimeline, physicalState.timeDisplay.isExpiring]);

  useEffect(() => {
    onDirected?.(directed);
  }, [directed.shot, directed.slot, directed.reason, onDirected]);

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

  // Figures live in a 1000-unit world but are drawn in pixels, so their size tracks the stage.
  const figureSize = Math.max(52, Math.min(150, stageWidth * 0.118));

  const focusActorFrame =
    (directed.actor && framesById[directed.actor]) ||
    actorFrames.find(f => f.id === primaryActor?.id && f.presence > 0.5) ||
    actorFrames.find(f => f.presence > 0.5 && cast.actors.find(a => a.id === f.id)?.cls !== 'background');

  const pointForSlot = (slot?: string): Point | undefined => {
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
      point: attention?.point ?? pointForSlot(directed.slot),
      progress: 1,
      reducedMotion: reducedMotion || !!frozen,
      zoomScale: stageWidth < 560 ? 0.82 : 1,
    }
  );

  /* ------------------------------------------------------- movement --- */

  const peopleObstacles = useCallback(
    (): CollisionBox[] =>
      actorFrames.filter(f => f.presence > 0.5).map(f => actorObstacle(f.id, f.pos, f.pose === 'sit')),
    [actorFrames]
  );

  const startWalk = useCallback(
    (pilot: Autopilot) => {
      autopilotRef.current = pilot;
      if (pilot.mode === 'cut') {
        setCutting(true);
        window.setTimeout(() => {
          const end = pilot.path[pilot.path.length - 1];
          playerPosRef.current = end;
          setPlayerPos(end);
          pilot.leg = pilot.path.length;
          setCutting(false);
        }, reducedMotion ? 0 : CUT_MS);
      }
    },
    [reducedMotion]
  );

  // A request to go somewhere for an intent.
  const lastMoveNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!move || frozen || move.nonce === lastMoveNonce.current) return;
    lastMoveNonce.current = move.nonce;
    const found = intentById(experience, move.intentId);
    const spot = hotspotsRef.current.find(h => h.intents.some(i => i.id === move.intentId));
    if (!found) return;
    const from = playerPosRef.current;
    const anchor: Point = spot?.anchor ?? from;
    const recipe = found.commitment ? recipeFor(found.commitment) : null;
    // A screen on the wall or an elevator across the hall is seen from where one stands.
    const offFloor = anchor[1] < WORLD_COLLISIONS[world].bounds.minY - 2;
    const inPlace = !spot || spot.self || (recipe ? !recipe.approach : false) || (found.kind === 'look' && offFloor && !spot?.stand);
    const resolution = resolveApproach({
      world,
      from,
      anchor,
      stand: found.kind === 'deed' || spot?.stand ? spot?.stand : undefined,
      inPlace,
      obstacles: [...cast.staticObstacles, ...peopleObstacles()],
    });
    onApproachStarted?.({ intentId: move.intentId, mode: resolution.mode, diagnostics: resolution.diagnostics });

    // Reduced motion: no walking across the room, a clean cut instead.
    const mode: ResolutionMode = reducedMotion && resolution.mode === 'walk' ? 'cut' : resolution.mode;
    const end = resolution.stand ?? from;
    const path = mode === 'walk' ? resolution.path! : [from, end];

    let perform: Autopilot['perform'];
    if (found.commitment && recipe) {
      const exitSlot = recipe.exits ? slotPoint(WORLD_EXIT(world)) : undefined;
      perform = {
        lead: recipe.lead,
        gesture: recipe.gesture,
        holdMs: performanceMs(recipe, reducedMotion) - (recipe.lead && !reducedMotion ? LEAD_MS : 0),
        exits: recipe.exits,
        exitTo: exitSlot,
      };
      setAttention(
        recipe.camera === 'insert'
          ? { shot: 'OBJECT_INSERT', point: anchor, atMs: elapsedMs }
          : recipe.camera === 'two_shot' && spot?.actorId
          ? { shot: 'TWO_SHOT', actor: spot.actorId, atMs: elapsedMs }
          : recipe.camera === 'hero'
          ? { shot: 'OVER_SHOULDER', atMs: elapsedMs }
          : { shot: 'WIDE_SILENCE', atMs: elapsedMs }
      );
    } else {
      setAttention(null);
    }
    startWalk({ intentId: move.intentId, kind: move.kind, mode, path, leg: 1, face: resolution.face, startedAt: performance.now(), perform });
  }, [move?.nonce]);

  // A cancelled approach stops where the hero is.
  useEffect(() => {
    if (phase === 'exploring' && autopilotRef.current?.kind === 'look') {
      autopilotRef.current = null;
      setPlayerPose('idle');
    }
  }, [phase]);

  const arrive = useCallback((pilot: Autopilot) => {
    const pos = playerPosRef.current;
    setPlayerFacing(facingToward(pos, pilot.face, 'back'));
    if (pilot.kind === 'look') {
      autopilotRef.current = null;
      setPlayerPose('turn');
      const spot = hotspotsRef.current.find(h => h.intents.some(i => i.id === pilot.intentId));
      setAttention(spot?.actorId ? { shot: 'TWO_SHOT', actor: spot.actorId, atMs: clockRef.current.ms } : { shot: 'OBJECT_INSERT', point: spot?.anchor, atMs: clockRef.current.ms });
      if (pilot.intentId) callbacks.current.onArrived?.(pilot.intentId, pilot.mode);
      return;
    }
    if (pilot.kind === 'deed' && pilot.perform) {
      pilot.perform.startedAt = performance.now();
      if (pilot.intentId) callbacks.current.onArrived?.(pilot.intentId, pilot.mode);
      return;
    }
    autopilotRef.current = null;
    setPlayerPose('idle');
  }, []);

  /* ------------------------------------------------------------ loop --- */

  const velocityRef = useRef<Point>([0, 0]);
  const walkPhaseRef = useRef(0);
  const lastFramesKeyRef = useRef('');
  const actorFramesRef = useRef(actorFrames);
  actorFramesRef.current = actorFrames;
  const manualAllowedRef = useRef(interactive);
  manualAllowedRef.current = interactive;

  useEffect(() => {
    if (frozen) return;
    let animId: number;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      /* Actors are a pure function of world time; once a deed is committed that time stands still. */
      const clock = clockRef.current;
      const sceneT = clock.frozen ? clock.ms : clock.ms + Math.min(150, now - clock.at);
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

      const pilot = autopilotRef.current;
      if (pilot) {
        const perform = pilot.perform;
        if (perform?.startedAt !== undefined) {
          // The deed itself: a lead gesture, the held gesture, and for a departure the walk out.
          const since = now - perform.startedAt;
          const leadMs = perform.lead && !reducedMotion ? LEAD_MS : 0;
          if (since < leadMs) setPlayerPose(perform.lead!);
          else if (perform.exits && perform.exitTo) {
            const [cx, cy] = playerPosRef.current;
            const [tx, ty] = perform.exitTo;
            const d = Math.hypot(tx - cx, ty - cy);
            if (d > 0.6 && !reducedMotion) {
              const stepLen = Math.min(d, AUTOPILOT_SPEED * dt);
              const next: Point = [cx + ((tx - cx) / d) * stepLen, cy + ((ty - cy) / d) * stepLen];
              playerPosRef.current = next;
              setPlayerPos(next);
              walkPhaseRef.current = (walkPhaseRef.current + stepLen / PLAYER_STRIDE) % 1;
              setWalkPhase(walkPhaseRef.current);
              setPlayerFacing(facingToward([cx, cy], [tx, ty]));
            }
            setPlayerPose('leave');
            setPlayerPresence(Math.max(0, 1 - Math.max(0, since - leadMs) / Math.max(400, perform.holdMs)));
          } else setPlayerPose(perform.gesture);
          if (since >= leadMs + perform.holdMs) {
            autopilotRef.current = null;
            callbacks.current.onEnacted?.();
          }
        } else if (pilot.leg >= pilot.path.length) {
          arrive(pilot);
        } else if (pilot.mode === 'walk') {
          const target = pilot.path[pilot.leg];
          const [cx, cy] = playerPosRef.current;
          const d = Math.hypot(target[0] - cx, target[1] - cy);
          const stepLen = AUTOPILOT_SPEED * dt;
          let next: Point;
          if (d <= stepLen) {
            next = target;
            pilot.leg += 1;
          } else {
            next = [cx + ((target[0] - cx) / d) * stepLen, cy + ((target[1] - cy) / d) * stepLen];
          }
          const moved = Math.hypot(next[0] - cx, next[1] - cy);
          playerPosRef.current = next;
          setPlayerPos(next);
          if (moved > 1e-4) {
            const dx = next[0] - cx;
            const dy = next[1] - cy;
            setPlayerFacing(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'front' : 'back');
            walkPhaseRef.current = (walkPhaseRef.current + moved / PLAYER_STRIDE) % 1;
            setWalkPhase(walkPhaseRef.current);
            setPlayerPose('walk');
          }
        } else if (pilot.mode === 'in_place' || pilot.mode === 'text') {
          pilot.leg = pilot.path.length;
        }
      } else if (manualAllowedRef.current) {
        // Optional free movement with the keys; never required.
        let ix = 0;
        let iy = 0;
        const keys = keysPressed.current;
        if (keys['w'] || keys['W'] || keys['ArrowUp']) iy -= 1;
        if (keys['s'] || keys['S'] || keys['ArrowDown']) iy += 1;
        if (keys['a'] || keys['A'] || keys['ArrowLeft']) ix -= 1;
        if (keys['d'] || keys['D'] || keys['ArrowRight']) ix += 1;
        if (ix !== 0 && iy !== 0) {
          ix *= 0.7071;
          iy *= 0.7071;
        }
        const hasIntent = ix !== 0 || iy !== 0;
        const [vx, vy] = velocityRef.current;
        const k = Math.min(1, dt / (hasIntent ? ACCEL_TAU : DECEL_TAU));
        const nvx = vx + (ix * PLAYER_SPEED - vx) * k;
        const nvy = vy + (iy * PLAYER_SPEED - vy) * k;
        const speed = Math.hypot(nvx, nvy);
        velocityRef.current = speed < 0.4 && !hasIntent ? [0, 0] : [nvx, nvy];
        if (hasIntent) {
          if (Math.abs(ix) > Math.abs(iy)) setPlayerFacing(ix > 0 ? 'right' : 'left');
          else setPlayerFacing(iy > 0 ? 'front' : 'back');
        }
        if (speed >= 0.4) {
          const people: CollisionBox[] = actorFramesRef.current.filter(f => f.presence > 0.5).map(f => actorObstacle(f.id, f.pos, f.pose === 'sit'));
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

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [scenario.world, frozen, cast.actors.length, computeFrames, arrive, reducedMotion]);

  useEffect(() => {
    if (frozen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (!['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      if (!manualAllowedRef.current) return;
      keysPressed.current[e.key] = true;
      if (autopilotRef.current && autopilotRef.current.kind !== 'deed') {
        autopilotRef.current = null;
        callbacks.current.onManualMove?.();
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
  }, [frozen]);

  // A tap or click on the floor walks there: optional, and never needed to act.
  const onStagePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || (e.target as HTMLElement).closest('button, a, [role="dialog"], .vivi-dock')) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = ((e.clientX - rect.left) / rect.width) * 100;
    const sy = ((e.clientY - rect.top) / rect.height) * 100;
    const [tx, ty] = cameraFrame.translate;
    const wx = (sx - tx) / cameraFrame.zoom;
    const wy = (sy - ty) / cameraFrame.zoom;
    const bounds = WORLD_COLLISIONS[world].bounds;
    if (wy < bounds.minY - 4) return;
    const from = playerPosRef.current;
    const path = findPath(world, from, [wx, wy], { extra: [...cast.staticObstacles, ...peopleObstacles()] });
    if (path.length < 2) return;
    if (autopilotRef.current?.kind === 'look') callbacks.current.onManualMove?.();
    setAttention(null);
    startWalk({ mode: reducedMotion ? 'cut' : 'walk', path, leg: 1, face: path[path.length - 1], startedAt: performance.now() });
  };

  /* ----------------------------------------------------------- sound --- */

  const audible = !frozen;
  useEffect(() => {
    ambience.setMuted(isMuted);
  }, [isMuted]);
  useEffect(() => {
    if (audible) ambience.setRestraint(committed ? Math.max(0.5, cinematic?.soundRestraint ?? 0) : cinematic?.soundRestraint ?? 0);
  }, [audible, committed, cinematic?.soundRestraint]);
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
    if (audible && physicalState.ambientAudioCue === 'intercom_ring' && lastIntercomRef.current !== 'intercom_ring') ambience.intercom();
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
    active: phase !== 'orienting',
    doorState: physicalState.door.state,
    phoneLit: physicalState.phone.isScreenLit,
    elevatorText: physicalState.elevator.indicatorText,
    elevatorOpen: physicalState.elevator.doorsOpen && !!physicalState.elevator.indicatorText,
    vehicleIn: physicalState.elevator.doorsOpen && !physicalState.elevator.indicatorText,
    clockText: physicalState.timeDisplay.text,
    dim: committed ? 0.18 : 0,
    objects: cast.keyObjects.map(k => k.kind),
    intercomRinging: physicalState.ambientAudioCue === 'intercom_ring',
  };

  const grade = cinematic?.lightingDef;
  const lightMode = physicalState.lightMode;
  const gradeDarkness = (grade?.darkness ?? 0) + (committed ? grade?.pressureDim ?? 0.12 : 0) + (lightMode === 'dim' ? 0.18 : lightMode === 'out' ? 0.45 : 0);

  const carriedPhone = scenario.actions.some(a => a.slotInfo.carried && a.slotInfo.diegeticType === 'phone');
  const depthEntities: Array<{ key: string; y: number; node: React.ReactNode }> = [];

  for (const obj of cast.keyObjects) {
    if (!obj.prop) continue;
    const isPhone = obj.kind === 'phone';
    const glinting = physicalState.glintSlots.includes(obj.slot);
    const active = isPhone
      ? physicalState.phone.isScreenLit || glinting
      : glinting || (obj.activeAtMs !== undefined && worldMs >= obj.activeAtMs && worldMs < obj.activeAtMs + 6000);
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
          style={{ left: `${frame.pos[0]}%`, top: `${frame.pos[1]}%`, '--depth': depthScale(frame.pos[1]), opacity: frame.presence } as React.CSSProperties}
        >
          <span className="vivi-contact" aria-hidden="true" />
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
        className="vivi-figure is-player"
        style={{ left: `${playerPos[0]}%`, top: `${playerPos[1]}%`, '--depth': depthScale(playerPos[1]), opacity: playerPresence } as React.CSSProperties}
      >
        <span className="vivi-contact" aria-hidden="true" />
        <span className="vivi-player-mark" aria-hidden="true" />
        <CharacterFigure id={scenario.playerCharacter} facing={playerFacing} pose={playerPose} size={figureSize} phase={playerPose === 'walk' || playerPose === 'leave' ? walkPhase : undefined} />
        {carriedPhone && physicalState.phone.isScreenLit && (
          <span className={`vivi-carried-phone ${physicalState.phone.isVibrating ? 'is-vibrating' : ''}`}>{physicalState.phone.previewText}</span>
        )}
      </div>
    ),
  });

  depthEntities.sort((a, b) => a.y - b.y);

  const showHotspots = interactive;
  const openingLine = phase === 'orienting' ? scenario.setup : null;

  return (
    <div className={`vivi-stage-frame relative select-none ${committed ? 'is-committed' : ''}`}>
      <div
        className={`vivi-stage relative overflow-hidden ${phase === 'pausing' || phase === 'boundary' ? 'is-closing' : ''} ${phase === 'boundary' ? 'is-boundary' : ''}`}
        ref={stageRef}
        onPointerDown={onStagePointer}
        data-elapsed={Math.round(elapsedMs)}
        data-phase={phase}
        data-shot={directed.shot}
        data-shot-reason={directed.reason}
        data-player={`${playerPos[0].toFixed(1)},${playerPos[1].toFixed(1)}`}
      >
        <div
          className="vivi-world"
          style={{ transform: cameraFrame.transform, transition: cameraFrame.transition, '--zoom': cameraFrame.zoom.toFixed(4) } as React.CSSProperties}
        >
          <SceneBackdrop world={scenario.world} state={sceneState} />
          <SceneMidground world={scenario.world} state={sceneState} />

          <div className="vivi-depth">
            {depthEntities.map(entity => (
              <React.Fragment key={entity.key}>{entity.node}</React.Fragment>
            ))}

            {showHotspots &&
              hotspots.map(spot => {
                const [x, y] = spot.self ? [playerPos[0], playerPos[1]] : spot.anchor;
                const hasDeed = spot.intents.some(i => i.kind === 'deed');
                // Above a person's head: a figure is figureSize px tall on a stage 0.6 × its width.
                const headroom = ((figureSize * Number(depthScale(y))) / (stageWidth * 0.6)) * 100 + 3;
                const lift = (spot.self || spot.actorId) && !spot.throughDoor ? headroom : 2;
                return (
                  <button
                    key={spot.key}
                    type="button"
                    data-hotspot={spot.key}
                    onClick={() => onSelectHotspot?.(spot.key)}
                    aria-label={`${spot.label}${spot.intents.length > 1 ? ` (+${spot.intents.length - 1})` : ''}`}
                    aria-pressed={selectedKey === spot.key}
                    className={`vivi-hotspot ${selectedKey === spot.key ? 'is-selected' : ''} ${hasDeed ? 'has-deed' : ''} ${spot.self ? 'is-self' : ''}`}
                    style={{ left: `${x}%`, top: `${y - lift}%` }}
                  >
                    <span className="vivi-hotspot-ring" aria-hidden="true" />
                    <span className="vivi-hotspot-label">{spot.label}</span>
                  </button>
                );
              })}
          </div>

          {/* The near layer drifts a little faster than the room when the lens moves: depth without motion for its own sake. */}
          <div
            className="vivi-parallax"
            style={{
              transform: reducedMotion || frozen ? undefined : `translate(${(cameraFrame.translate[0] * 0.05).toFixed(3)}%, ${(cameraFrame.translate[1] * 0.03).toFixed(3)}%)`,
              transition: cameraFrame.transition,
            }}
          >
            <SceneForeground world={scenario.world} state={sceneState} />
          </div>
          <SceneLighting world={scenario.world} state={sceneState} />
          {debug && <DebugOverlay scenario={scenario} frames={actorFrames} playerPos={playerPos} />}
        </div>

        {grade && (
          <div className={`vivi-grade ${lightMode === 'flicker' && !reducedMotion ? 'is-flicker' : ''}`} aria-hidden="true">
            <div className="vivi-grade-tint" style={{ background: grade.tint, opacity: grade.tintStrength }} />
            <div className="vivi-grade-dark" style={{ opacity: Math.min(0.72, gradeDarkness) }} />
            <div className="vivi-grade-vignette" style={{ opacity: grade.vignette }} />
          </div>
        )}
        <div className="vivi-film" aria-hidden="true" />

        {openingLine && <p className="vivi-subtitle">{openingLine}</p>}
        {physicalState.npcAction.speakingLine && !committed && (
          <p className="vivi-subtitle vivi-subtitle-speech">«{physicalState.npcAction.speakingLine}»</p>
        )}

        <div className={`vivi-cut ${cutting ? 'is-on' : ''}`} aria-hidden="true" />
        <div className="vivi-boundary" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- helpers --- */

const WORLD_SLOTS = (world: CanonicalScenario['world']) => (worldTemplates[world] || worldTemplates.apartment_night).slots;
const WORLD_EXIT = (world: CanonicalScenario['world']) => WORLD_KNOWLEDGE[world]?.exit ?? 'front_door';

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
  return (0.84 + t * 0.26).toFixed(3);
}

/** Director Lab only: collision, standing spots and every actor's route. */
function DebugOverlay({ scenario, frames, playerPos }: { scenario: CanonicalScenario; frames: ActorFrame[]; playerPos: Point }) {
  const cast = scenarioCast(scenario);
  const config = WORLD_COLLISIONS[scenario.world];
  const routes = cast.cues
    .filter(c => (c.act === 'walk_to' || c.act === 'exit' || c.act === 'enter') && (c.to || c.then))
    .map((c, i) => {
      const actor = cast.actors.find(a => a.id === c.actor);
      const from = c.act === 'enter' ? c.to! : actor?.spawn ?? [50, 70];
      const to = c.act === 'enter' ? c.then ?? c.to! : c.to!;
      return { key: `${c.actor}-${i}`, path: findPath(scenario.world, from as Point, to, { extra: cast.staticObstacles, via: c.via }) };
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

export { OPENING_LOCK_MS };
